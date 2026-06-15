import { z } from "zod";

export const bruneiPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+673[2-8]\d{6}$/,
    "Phone number must be a valid Brunei number such as +6738123456"
  );

export const requestOtpSchema = z
  .object({
    phone_number: bruneiPhoneSchema
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    phone_number: bruneiPhoneSchema,
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits")
  })
  .strict();

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
