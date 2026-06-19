import { Router } from "express";

import {
  forgotPasswordRateLimiter,
  requestEmailPasswordOtpRateLimiter,
  requestOtpRateLimiter,
  resetPasswordRateLimiter,
  verifyEmailPasswordOtpRateLimiter,
  verifyOtpRateLimiter
} from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  completeRegistration,
  forgotPassword,
  requestEmailPasswordOtp,
  requestOtp,
  requestRegistrationOtp,
  resetPassword,
  verifyEmailPasswordOtp,
  verifyOtp
} from "./auth.controller.js";
import {
  completeRegistrationSchema,
  forgotPasswordSchema,
  requestEmailPasswordOtpSchema,
  requestOtpSchema,
  requestRegistrationOtpSchema,
  resetPasswordSchema,
  verifyEmailPasswordOtpSchema,
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
authRouter.post(
  "/registration/request-otp",
  requestOtpRateLimiter,
  validate({ body: requestRegistrationOtpSchema }),
  requestRegistrationOtp
);
authRouter.post(
  "/registration/complete",
  verifyOtpRateLimiter,
  validate({ body: completeRegistrationSchema }),
  completeRegistration
);
authRouter.post(
  "/request-email-password-otp",
  requestEmailPasswordOtpRateLimiter,
  validate({ body: requestEmailPasswordOtpSchema }),
  requestEmailPasswordOtp
);
authRouter.post(
  "/verify-email-password-otp",
  verifyEmailPasswordOtpRateLimiter,
  validate({ body: verifyEmailPasswordOtpSchema }),
  verifyEmailPasswordOtp
);
authRouter.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validate({ body: forgotPasswordSchema }),
  forgotPassword
);
authRouter.post(
  "/reset-password",
  resetPasswordRateLimiter,
  validate({ body: resetPasswordSchema }),
  resetPassword
);
