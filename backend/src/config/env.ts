import { z } from "zod";

const durationPattern = /^\d+(ms|s|m|h|d)$/;

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().int().min(1).max(65535),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().regex(durationPattern),
    CORS_ALLOWED_ORIGINS: z.string().min(1),
    OTP_PEPPER: z.string().min(32),
    TRUST_PROXY: z.string().regex(/^(false|true|[1-9]\d*)$/),
    LOCK_CLEANUP_INTERVAL_MS: z
      .string()
      .regex(/^[1-9]\d*$/, "Must be a positive integer")
      .transform(Number)
      .pipe(z.number().int().min(1000).max(86_400_000))
      .optional(),
    STRIPE_SECRET_KEY: z
      .string()
      .regex(
        /^sk_(test|live)_[A-Za-z0-9]+$/,
        "Must be a valid Stripe secret key"
      ),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .regex(
        /^whsec_[A-Za-z0-9]+$/,
        "Must be a valid Stripe webhook signing secret"
      ),
    STRIPE_SUCCESS_URL: z.string().url(),
    STRIPE_CANCEL_URL: z.string().url(),
    EMAIL_PROVIDER: z.literal("local").default("local"),
    EMAIL_FROM: z.string().email().default("no-reply@courtify.local")
  });

const parsed = rawEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

const databaseUrl = new URL(parsed.data.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
}

const corsAllowedOrigins = parsed.data.CORS_ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (
  corsAllowedOrigins.length === 0 ||
  corsAllowedOrigins.includes("*") ||
  corsAllowedOrigins.some((origin) => {
    try {
      const url = new URL(origin);
      return !["http:", "https:"].includes(url.protocol) || url.origin !== origin;
    } catch {
      return true;
    }
  })
) {
  throw new Error(
    "CORS_ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins without paths or wildcards"
  );
}

if (
  parsed.data.NODE_ENV === "production" &&
  corsAllowedOrigins.some((origin) => !origin.startsWith("https://"))
) {
  throw new Error("Production CORS origins must use HTTPS");
}

if (
  parsed.data.NODE_ENV === "production" &&
  (parsed.data.JWT_SECRET.length < 64 || parsed.data.OTP_PEPPER.length < 64)
) {
  throw new Error(
    "JWT_SECRET and OTP_PEPPER must each contain at least 64 characters in production"
  );
}

if (parsed.data.NODE_ENV === "production" && parsed.data.TRUST_PROXY === "true") {
  throw new Error(
    "TRUST_PROXY=true is unsafe in production; configure the exact proxy hop count"
  );
}

const stripeSuccessUrl = new URL(parsed.data.STRIPE_SUCCESS_URL);
const stripeCancelUrl = new URL(parsed.data.STRIPE_CANCEL_URL);

if (
  !["http:", "https:"].includes(stripeSuccessUrl.protocol) ||
  !["http:", "https:"].includes(stripeCancelUrl.protocol)
) {
  throw new Error("Stripe success and cancel URLs must use HTTP or HTTPS");
}

if (
  parsed.data.NODE_ENV === "production" &&
  (stripeSuccessUrl.protocol !== "https:" ||
    stripeCancelUrl.protocol !== "https:")
) {
  throw new Error("Production Stripe redirect URLs must use HTTPS");
}

if (
  parsed.data.NODE_ENV === "production" &&
  !parsed.data.STRIPE_SECRET_KEY.startsWith("sk_live_")
) {
  throw new Error("Production must use a live Stripe secret key");
}

const trustProxy =
  parsed.data.TRUST_PROXY === "false"
    ? false
    : parsed.data.TRUST_PROXY === "true"
      ? true
      : Number.parseInt(parsed.data.TRUST_PROXY, 10);

export const env = Object.freeze({
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  corsAllowedOrigins,
  otpPepper: parsed.data.OTP_PEPPER,
  trustProxy,
  lockCleanupIntervalMs: parsed.data.LOCK_CLEANUP_INTERVAL_MS ?? 60_000,
  stripeSecretKey: parsed.data.STRIPE_SECRET_KEY,
  stripeWebhookSecret: parsed.data.STRIPE_WEBHOOK_SECRET,
  stripeSuccessUrl: parsed.data.STRIPE_SUCCESS_URL,
  stripeCancelUrl: parsed.data.STRIPE_CANCEL_URL,
  emailProvider: parsed.data.EMAIL_PROVIDER,
  emailFrom: parsed.data.EMAIL_FROM.toLowerCase(),
  isProduction: parsed.data.NODE_ENV === "production"
});
