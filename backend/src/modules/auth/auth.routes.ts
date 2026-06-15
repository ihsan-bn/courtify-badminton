import { Router } from "express";

import {
  requestOtpRateLimiter,
  verifyOtpRateLimiter
} from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { requestOtp, verifyOtp } from "./auth.controller.js";
import {
  requestOtpSchema,
  verifyOtpSchema
} from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post(
  "/request-otp",
  requestOtpRateLimiter,
  validate({ body: requestOtpSchema }),
  requestOtp
);
authRouter.post(
  "/verify-otp",
  verifyOtpRateLimiter,
  validate({ body: verifyOtpSchema }),
  verifyOtp
);
