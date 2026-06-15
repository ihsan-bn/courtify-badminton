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
      event.type !== "payment_intent.payment_failed"
    ) {
      return;
    }

    await withTransaction(async (client) => {
      const claimed = await paymentsRepository.claimPaymentEvent(
        client,
        event.id,
        event.type,
        event
      );
      if (!claimed) {
        return;
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
        return;
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
        return;
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
        return;
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
        return;
      }

      if (
        booking.status !== "locked" ||
        !booking.lock_expires_at ||
        booking.lock_expires_at.getTime() <= Date.now()
      ) {
        console.warn(
          `Booking ${booking.id} is not eligible for Stripe confirmation`
        );
        return;
      }

      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id;

      if (!paymentIntentId) {
        console.warn(
          `Stripe checkout session ${checkoutSession.id} has no payment intent`
        );
        return;
      }

      const confirmed = await paymentsRepository.confirmBooking(
        client,
        booking.id,
        paymentIntentId
      );
      if (!confirmed) {
        console.warn(
          `Booking ${booking.id} expired before Stripe confirmation`
        );
        return;
      }

      await paymentsRepository.confirmBookingSlots(client, booking.id);
    });
  }
};
