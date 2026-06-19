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

export const requestEmailPasswordOtpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
    otp_channel: z.enum(["email", "sms"])
  })
  .strict();

export const verifyEmailPasswordOtpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits")
  })
  .strict();

export const requestRegistrationOtpSchema = z
  .object({
    phone_number: bruneiPhoneSchema
  })
  .strict();

export const completeRegistrationSchema = z
  .object({
    phone_number: bruneiPhoneSchema,
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
    confirm_password: z.string().min(8).max(128)
  })
  .strict()
  .refine((input) => input.password === input.confirm_password, {
    message: "Password and confirm password must match",
    path: ["confirm_password"]
  });

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254)
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: z.string().min(8).max(128),
    confirm_password: z.string().min(8).max(128)
  })
  .strict()
  .refine((input) => input.password === input.confirm_password, {
    message: "Password and confirm password must match",
    path: ["confirm_password"]
  });

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RequestEmailPasswordOtpInput = z.infer<
  typeof requestEmailPasswordOtpSchema
>;
export type VerifyEmailPasswordOtpInput = z.infer<
  typeof verifyEmailPasswordOtpSchema
>;
export type RequestRegistrationOtpInput = z.infer<
  typeof requestRegistrationOtpSchema
>;
export type CompleteRegistrationInput = z.infer<
  typeof completeRegistrationSchema
>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
