import type Stripe from "stripe";
import { DatabaseError } from "pg";

import { withTransaction } from "../../config/database.js";
import { env } from "../../config/env.js";
import { stripe } from "../../config/stripe.js";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError
} from "../../utils/errors.js";
import { bookingsRepository } from "../bookings/bookings.repository.js";
import { emailService } from "../email/email.service.js";
import { paymentsRepository } from "./payments.repository.js";
import type {
  CreateCheckoutSessionInput,
  RetryCheckoutSessionInput
} from "./payments.schemas.js";

interface CheckoutSessionResult {
  booking_id: string;
  checkout_session_id: string;
  checkout_url: string;
}

const bruneiDateTimeFormatter = new Intl.DateTimeFormat("en-BN", {
  timeZone: "Asia/Brunei",
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true
});

function convertBndToCents(amount: string): number {
  const match = /^(\d{1,8})\.(\d{2})$/.exec(amount);
  if (!match) {
    throw new Error("Stored booking amount has an invalid format");
  }

  const dollars = Number(match[1]);
  const cents = Number(match[2]);
  const totalCents = dollars * 100 + cents;

  if (!Number.isSafeInteger(totalCents) || totalCents < 1) {
    throw new Error("Stored booking amount is outside the supported range");
  }

  return totalCents;
}

function createDescription(
  courtName: string,
  reservationStartAt: Date,
  reservationEndAt: Date
): string {
  return `${courtName}: ${bruneiDateTimeFormatter.format(
    reservationStartAt
  )} to ${bruneiDateTimeFormatter.format(reservationEndAt)}`;
}

async function createStripeCheckoutSession(
  booking: {
    id: string;
    user_id: string;
    court_name: string;
    total_amount_bnd: string;
    reservation_start_at: Date;
    reservation_end_at: Date;
  },
  idempotencyKey: string
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: env.stripeSuccessUrl,
        cancel_url: env.stripeCancelUrl,
        client_reference_id: booking.id,
        metadata: {
          booking_id: booking.id,
          user_id: booking.user_id
        },
        payment_intent_data: {
          metadata: {
            booking_id: booking.id,
            user_id: booking.user_id
          }
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "bnd",
              unit_amount: convertBndToCents(booking.total_amount_bnd),
              product_data: {
                name: "Courtify-Badminton Booking",
                description: createDescription(
                  booking.court_name,
                  booking.reservation_start_at,
                  booking.reservation_end_at
                )
              }
            }
          }
        ]
      },
      { idempotencyKey }
    );
  } catch {
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_ERROR",
      "Unable to create Stripe Checkout session"
    );
  }
}

async function expirePreviousCheckoutSession(
  checkoutSessionId: string
): Promise<void> {
  try {
    const checkoutSession =
      await stripe.checkout.sessions.retrieve(checkoutSessionId);

    if (checkoutSession.status === "complete") {
      throw new ConflictError(
        "The existing Checkout Session has already completed"
      );
    }
    if (checkoutSession.status === "open") {
      await stripe.checkout.sessions.expire(checkoutSessionId);
    }
  } catch (error) {
    if (error instanceof ConflictError) {
      throw error;
    }
    console.error(
      `Failed to close previous Stripe Checkout Session ${checkoutSessionId}`,
      error
    );
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_ERROR",
      "Unable to safely replace the existing Checkout Session"
    );
  }
}

function isSlotConflict(error: unknown): boolean {
  return (
    error instanceof DatabaseError &&
    error.code === "23505" &&
    error.constraint === "booking_slots_court_date_hour_key"
  );
}

function getMetadataBookingId(paymentIntent: Stripe.PaymentIntent): string | null {
  const bookingId = paymentIntent.metadata.booking_id;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    bookingId ?? ""
  )
    ? (bookingId ?? null)
    : null;
}

function getRefundMetadataBookingId(refund: Stripe.Refund): string | null {
  const bookingId = refund.metadata?.booking_id;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    bookingId ?? ""
  )
    ? (bookingId ?? null)
    : null;
}

function mapStripeRefundStatus(
  status: Stripe.Refund["status"]
):
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "cancelled" {
  if (status === "requires_action") {
    return "requires_action";
  }
  if (status === "succeeded") {
    return "succeeded";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "canceled") {
    return "cancelled";
  }
  return "pending";
}

export const paymentsService = {
  async createCheckoutSession(
    userId: string,
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSessionResult> {
    return withTransaction(async (client) => {
      const booking = await paymentsRepository.findBookingForCheckout(
        client,
        input.booking_id
      );

      if (!booking) {
        throw new NotFoundError("Booking not found");
      }
      if (booking.user_id !== userId) {
        throw new ForbiddenError("Booking belongs to another customer");
      }
      if (booking.status !== "locked") {
        throw new ConflictError(
          "Only locked bookings can proceed to checkout"
        );
      }
      if (
        !booking.lock_expires_at ||
        booking.lock_expires_at.getTime() <= Date.now()
      ) {
        throw new ConflictError("Booking lock has expired");
      }
      if (booking.stripe_checkout_session_id) {
        throw new ConflictError(
          "A checkout session already exists for this booking"
        );
      }

      const checkoutSession = await createStripeCheckoutSession(
        booking,
        `checkout-session:${booking.id}`
      );

      if (!checkoutSession.url) {
        throw new AppError(
          502,
          "PAYMENT_PROVIDER_ERROR",
          "Stripe Checkout session did not provide a checkout URL"
        );
      }

      const stored = await paymentsRepository.storeCheckoutSession(
        client,
        booking.id,
        userId,
        checkoutSession.id
      );

      if (!stored) {
        try {
          await stripe.checkout.sessions.expire(checkoutSession.id);
        } catch (error) {
          console.error(
            "Failed to expire unusable Stripe Checkout session",
            error
          );
        }
        throw new ConflictError(
          "Booking lock expired before checkout could be finalized"
        );
      }

      return {
        booking_id: booking.id,
        checkout_session_id: checkoutSession.id,
        checkout_url: checkoutSession.url
      };
    });
  },

  async retryCheckoutSession(
    userId: string,
    input: RetryCheckoutSessionInput
  ): Promise<CheckoutSessionResult> {
    try {
      return await withTransaction(async (client) => {
        const booking = await paymentsRepository.findBookingForCheckout(
          client,
          input.booking_id
        );

        if (!booking) {
          throw new NotFoundError("Booking not found");
        }
        if (booking.user_id !== userId) {
          throw new ForbiddenError("Booking belongs to another customer");
        }
        if (booking.status !== "locked" && booking.status !== "expired") {
          throw new ConflictError(
            "This booking is not eligible for payment retry"
          );
        }

        const previousCheckoutSessionId =
          booking.stripe_checkout_session_id;
        const lockHasExpired =
          booking.status === "locked" &&
          (!booking.lock_expires_at ||
            booking.lock_expires_at.getTime() <= Date.now());

        if (lockHasExpired) {
          await paymentsRepository.deleteLockedBookingSlots(
            client,
            booking.id
          );
          await paymentsRepository.markLockedBookingExpired(
            client,
            booking.id
          );
        }

        if (booking.status === "expired" || lockHasExpired) {
          if (!booking.court_active) {
            throw new ConflictError(
              "The original court is no longer available"
            );
          }

          await paymentsRepository.deleteLockedBookingSlots(
            client,
            booking.id
          );
          const relocked = await paymentsRepository.relockExpiredBooking(
            client,
            booking.id
          );
          if (!relocked) {
            throw new ConflictError(
              "The original booking time can no longer be retried"
            );
          }

          const expiredOverlappingBookingIds =
            await paymentsRepository.findExpiredOverlappingBookingIds(
              client,
              booking.id
            );
          await bookingsRepository.deleteSlotsForExpiredBookings(
            client,
            expiredOverlappingBookingIds
          );
          await bookingsRepository.markBookingsExpired(
            client,
            expiredOverlappingBookingIds
          );

          await paymentsRepository.recreateLockedBookingSlots(
            client,
            booking.id
          );
        }

        if (previousCheckoutSessionId) {
          await expirePreviousCheckoutSession(previousCheckoutSessionId);
        }

        const checkoutSession = await createStripeCheckoutSession(
          booking,
          `retry-checkout:${booking.id}:${
            previousCheckoutSessionId ?? "none"
          }`
        );

        if (!checkoutSession.url) {
          throw new AppError(
            502,
            "PAYMENT_PROVIDER_ERROR",
            "Stripe Checkout session did not provide a checkout URL"
          );
        }

        const stored = await paymentsRepository.replaceCheckoutSession(
          client,
          booking.id,
          userId,
          checkoutSession.id
        );
        if (!stored) {
          throw new ConflictError(
            "Booking lock expired before checkout could be retried"
          );
        }

        return {
          booking_id: booking.id,
          checkout_session_id: checkoutSession.id,
          checkout_url: checkoutSession.url
        };
      });
    } catch (error) {
      if (isSlotConflict(error)) {
        throw new ConflictError(
          "The original court slots are no longer available"
        );
      }
      throw error;
    }
  },

  verifyWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.stripeWebhookSecret
      );
    } catch (error) {
      console.warn("Stripe webhook signature verification failed", error);
      throw new AppError(
        400,
        "INVALID_WEBHOOK_SIGNATURE",
        "Invalid Stripe webhook signature"
      );
    }
  },

  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.expired" &&
      event.type !== "payment_intent.succeeded" &&
      event.type !== "payment_intent.payment_failed" &&
      event.type !== "refund.updated" &&
      event.type !== "charge.refunded"
    ) {
      return;
    }

    const confirmedBookingId: string | null = await withTransaction(
      async (client) => {
      const claimed = await paymentsRepository.claimPaymentEvent(
        client,
        event.id,
        event.type,
        event
      );
      if (!claimed) {
        return null;
      }

      if (event.type === "refund.updated") {
        const refund = event.data.object;
        const refundRecord = await paymentsRepository.findRefundForWebhook(
          client,
          refund.id,
          getRefundMetadataBookingId(refund)
        );
        if (!refundRecord) {
          console.warn(`Stripe refund ${refund.id} has no local refund record`);
          return null;
        }

        await paymentsRepository.attachPaymentEventToBooking(
          client,
          event.id,
          refundRecord.booking_id
        );
        await paymentsRepository.updateRefundWebhookStatus(
          client,
          refundRecord.id,
          refund.id,
          mapStripeRefundStatus(refund.status),
          refund.failure_reason ?? null
        );
        return null;
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntentId) {
          console.warn(`Refunded Stripe charge ${charge.id} has no payment intent`);
          return null;
        }

        const refundRecord =
          await paymentsRepository.findRefundByPaymentIntentForUpdate(
            client,
            paymentIntentId
          );
        if (!refundRecord) {
          console.warn(
            `Refunded Stripe charge ${charge.id} has no local refund record`
          );
          return null;
        }

        await paymentsRepository.attachPaymentEventToBooking(
          client,
          event.id,
          refundRecord.booking_id
        );
        await paymentsRepository.markRefundSucceededFromCharge(
          client,
          refundRecord.id,
          charge.amount_refunded
        );
        return null;
      }

      if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        const booking =
          await paymentsRepository.findBookingForPaymentFailure(
            client,
            paymentIntent.id,
            getMetadataBookingId(paymentIntent)
          );
        if (booking) {
          await paymentsRepository.attachPaymentEventToBooking(
            client,
            event.id,
            booking.id
          );
        }

        console.warn(
          `Stripe payment failed for payment intent ${paymentIntent.id}`
        );
        if (
          booking?.status === "locked" &&
          booking.lock_expires_at &&
          booking.lock_expires_at.getTime() <= Date.now()
        ) {
          await paymentsRepository.deleteLockedBookingSlots(
            client,
            booking.id
          );
          await paymentsRepository.markLockedBookingExpired(
            client,
            booking.id
          );
        }
        return null;
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const booking = await paymentsRepository.findBookingByPaymentIntent(
          client,
          paymentIntent.id
        );
        if (booking) {
          await paymentsRepository.attachPaymentEventToBooking(
            client,
            event.id,
            booking.id
          );
        }
        return null;
      }

      const checkoutSession = event.data.object;
      const booking =
        await paymentsRepository.findBookingByCheckoutSessionForUpdate(
          client,
          checkoutSession.id
        );

      if (!booking) {
        console.warn(
          `Stripe checkout session ${checkoutSession.id} has no booking`
        );
        return null;
      }

      await paymentsRepository.attachPaymentEventToBooking(
        client,
        event.id,
        booking.id
      );

      if (event.type === "checkout.session.expired") {
        if (booking.status === "locked") {
          await paymentsRepository.deleteLockedBookingSlots(
            client,
            booking.id
          );
          await paymentsRepository.markLockedBookingExpired(
            client,
            booking.id
          );
        }
        return null;
      }

      const expectedAmountCents = convertBndToCents(
        booking.total_amount_bnd
      );
      if (
        checkoutSession.mode !== "payment" ||
        checkoutSession.payment_status !== "paid" ||
        checkoutSession.currency?.toLowerCase() !== "bnd" ||
        checkoutSession.amount_total !== expectedAmountCents
      ) {
        console.warn(
          `Stripe checkout session ${checkoutSession.id} failed payment validation`
        );
        return null;
      }

      const paymentCompletedAt = new Date(event.created * 1000);
      if (
        booking.status !== "locked" ||
        !booking.lock_expires_at ||
        booking.lock_expires_at.getTime() < paymentCompletedAt.getTime()
      ) {
        console.warn(
          `Booking ${booking.id} is not eligible for Stripe confirmation`
        );
        return null;
      }

      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id;

      if (!paymentIntentId) {
        console.warn(
          `Stripe checkout session ${checkoutSession.id} has no payment intent`
        );
        return null;
      }

      const confirmed = await paymentsRepository.confirmBooking(
        client,
        booking.id,
        paymentIntentId,
        paymentCompletedAt
      );
      if (!confirmed) {
        console.warn(
          `Booking ${booking.id} expired before Stripe confirmation`
        );
        return null;
      }

      const expectedSlotCount =
        (booking.reservation_end_at.getTime() -
          booking.reservation_start_at.getTime()) /
        (60 * 60 * 1000);
      const confirmedSlotCount =
        await paymentsRepository.confirmBookingSlots(client, booking.id);
      if (confirmedSlotCount !== expectedSlotCount) {
        throw new Error(
          `Booking ${booking.id} slot confirmation count mismatch`
        );
      }

        return booking.id;
      }
    );

    if (confirmedBookingId) {
      await emailService.sendBookingConfirmation(confirmedBookingId);
    }
  }
};
