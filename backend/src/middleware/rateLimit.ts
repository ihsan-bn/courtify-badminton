import { rateLimit } from "express-rate-limit";

const commonOptions = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests; try again later"
    }
  }
};

export const globalRateLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 300
});

export const requestOtpRateLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: false
});

export const verifyOtpRateLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: false
});

export const requestEmailPasswordOtpRateLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: false
});

export const verifyEmailPasswordOtpRateLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: false
});

export const forgotPasswordRateLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: false
});

export const resetPasswordRateLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: false
});
