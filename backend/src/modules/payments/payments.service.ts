import { createRequire } from "node:module";

import { withTransaction } from "../../config/database.js";
import { env } from "../../config/env.js";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError
} from "../../utils/errors.js";
import { paymentsRepository } from "./payments.repository.js";
import type { CreateCheckoutSessionInput } from "./payments.schemas.js";

interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

interface StripeCheckoutSessions {
  create(
    parameters: {
      mode: "payment";
      success_url: string;
      cancel_url: string;
      client_reference_id: string;
      metadata: Record<string, string>;
      line_items: {
        quantity: number;
        price_data: {
          currency: "bnd";
          unit_amount: number;
          product_data: {
            name: string;
            description: string;
          };
        };
      }[];
    },
    options: { idempotencyKey: string }
  ): Promise<StripeCheckoutSession>;
  expire(sessionId: string): Promise<unknown>;
}

interface StripeClient {
  checkout: {
    sessions: StripeCheckoutSessions;
  };
}

type StripeConstructor = new (
  secretKey: string,
  options: { appInfo: { name: string; version: string } }
) => StripeClient;

interface CheckoutSessionResult {
  booking_id: string;
  checkout_session_id: string;
  checkout_url: string;
}

const requireFromCurrentModule = createRequire(__filename);
let stripeClient: StripeClient | undefined;

function getStripeConstructor(moduleValue: unknown): StripeConstructor {
  if (typeof moduleValue === "function") {
    return moduleValue as StripeConstructor;
  }

  if (typeof moduleValue === "object" && moduleValue !== null) {
    const moduleRecord = moduleValue as {
      default?: unknown;
      Stripe?: unknown;
    };
    if (typeof moduleRecord.default === "function") {
      return moduleRecord.default as StripeConstructor;
    }
    if (typeof moduleRecord.Stripe === "function") {
      return moduleRecord.Stripe as StripeConstructor;
    }
  }

  throw new Error("Official Stripe SDK did not provide a constructor");
}

function getStripeClient(): StripeClient {
  if (stripeClient) {
    return stripeClient;
  }

  try {
    const loadedStripeModule = requireFromCurrentModule("stripe") as unknown;
    const Stripe = getStripeConstructor(loadedStripeModule);
    stripeClient = new Stripe(env.stripeSecretKey, {
      appInfo: {
        name: "Courtify-Badminton",
        version: "1.0.0"
      }
    });
    return stripeClient;
  } catch (error) {
    console.error("Failed to initialize official Stripe SDK", error);
    throw new AppError(
      503,
      "PAYMENT_SERVICE_UNAVAILABLE",
      "Payment service is temporarily unavailable"
    );
  }
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

export const paymentsService = {
  async createCheckoutSession(
    userId: string,
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSessionResult> {
    return withTransaction(async (client) => {
      const stripe = getStripeClient();
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

      let checkoutSession: StripeCheckoutSession;
      try {
        checkoutSession = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            success_url: env.stripeSuccessUrl,
            cancel_url: env.stripeCancelUrl,
            client_reference_id: booking.id,
            metadata: {
              booking_id: booking.id,
              user_id: booking.user_id
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
          {
            idempotencyKey: `checkout-session:${booking.id}`
          }
        );
      } catch {
        throw new AppError(
          502,
          "PAYMENT_PROVIDER_ERROR",
          "Unable to create Stripe Checkout session"
        );
      }

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
  }
};
