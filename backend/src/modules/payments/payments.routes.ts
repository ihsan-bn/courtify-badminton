import { Router } from "express";

import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createCheckoutSession } from "./payments.controller.js";
import { createCheckoutSessionSchema } from "./payments.schemas.js";

export const paymentsRouter = Router();

paymentsRouter.post(
  "/checkout-session",
  authenticate,
  validate({ body: createCheckoutSessionSchema }),
  createCheckoutSession
);
