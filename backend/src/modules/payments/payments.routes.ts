import express, { Router } from "express";

import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  createCheckoutSession,
  handleStripeWebhook,
  retryCheckoutSession
} from "./payments.controller.js";
import {
  createCheckoutSessionSchema,
  retryCheckoutSessionSchema
} from "./payments.schemas.js";

export const paymentsWebhookRouter = Router();
export const paymentsRouter = Router();

paymentsWebhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleStripeWebhook
);

paymentsRouter.post(
  "/checkout-session",
  authenticate,
  validate({ body: createCheckoutSessionSchema }),
  createCheckoutSession
);

paymentsRouter.post(
  "/retry-checkout-session",
  authenticate,
  validate({ body: retryCheckoutSessionSchema }),
  retryCheckoutSession
);
