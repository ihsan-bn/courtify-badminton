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
  await paymentsService.processWebhookEvent(event);
  response.status(200).json({ received: true });
};
