import type { RequestHandler } from "express";

import {
  ForbiddenError,
  UnauthorizedError
} from "../../utils/errors.js";
import type {
  CreateCheckoutSessionInput,
  RetryCheckoutSessionInput
} from "./payments.schemas.js";
import { paymentsService } from "./payments.service.js";
import { auditService } from "../audit/audit.service.js";

export const createCheckoutSession: RequestHandler = async (
  request,
  response
) => {
  const authenticatedUser = request.authenticatedUser;
  if (!authenticatedUser) {
    throw new UnauthorizedError();
  }
  if (authenticatedUser.role !== "customer") {
    throw new ForbiddenError("Customer access required");
  }

  const result = await paymentsService.createCheckoutSession(
    authenticatedUser.id,
    request.body as CreateCheckoutSessionInput
  );
  await auditService.record({
    actor: { userId: authenticatedUser.id, role: "customer" },
    action: "checkout_session_created",
    entityType: "booking",
    entityId: result.booking_id,
    summary: "Customer created a Stripe Checkout session.",
    metadata: { checkout_session_id: result.checkout_session_id },
    request
  });
  response.status(201).json(result);
};

export const retryCheckoutSession: RequestHandler = async (
  request,
  response
) => {
  const authenticatedUser = request.authenticatedUser;
  if (!authenticatedUser) {
    throw new UnauthorizedError();
  }
  if (authenticatedUser.role !== "customer") {
    throw new ForbiddenError("Customer access required");
  }

  const result = await paymentsService.retryCheckoutSession(
    authenticatedUser.id,
    request.body as RetryCheckoutSessionInput
  );
  await auditService.record({
    actor: { userId: authenticatedUser.id, role: "customer" },
    action: "checkout_session_created",
    entityType: "booking",
    entityId: result.booking_id,
    summary: "Customer created a replacement Stripe Checkout session.",
    metadata: {
      checkout_session_id: result.checkout_session_id,
      retry: true
    },
    request
  });
  response.status(201).json(result);
};

export const handleStripeWebhook: RequestHandler = async (
  request,
  response
) => {
  const signature = request.header("stripe-signature");
  if (!signature) {
    console.warn("Stripe webhook rejected because the signature is missing");
    response.status(400).json({
      error: {
        code: "INVALID_WEBHOOK_SIGNATURE",
        message: "Invalid Stripe webhook signature"
      }
    });
    return;
  }

  if (!Buffer.isBuffer(request.body)) {
    console.warn("Stripe webhook rejected because the raw body is unavailable");
    response.status(400).json({
      error: {
        code: "INVALID_WEBHOOK_BODY",
        message: "Invalid Stripe webhook body"
      }
    });
    return;
  }

  const event = paymentsService.verifyWebhookEvent(request.body, signature);
  await auditService.record({
    actor: { userId: null, role: "system", name: "Stripe webhook" },
    action: "payment_webhook_received",
    entityType: "payment_event",
    summary: "Verified Stripe webhook event was received and processed.",
    metadata: { stripe_event_id: event.id, event_type: event.type },
    request
  });
  await paymentsService.processWebhookEvent(event);
  response.status(200).json({ received: true });
};
