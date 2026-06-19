import { z } from "zod";

const bruneiPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+673[2-8]\d{6}$/,
    "Phone number must be a valid Brunei number such as +6738123456"
  );

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().email().max(254)
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().email().max(254),
    phone_number: bruneiPhoneSchema
  })
  .strict();

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(8).max(128),
    new_password: z.string().min(8).max(128),
    confirm_new_password: z.string().min(8).max(128)
  })
  .strict()
  .refine((input) => input.new_password === input.confirm_new_password, {
    message: "New password and confirm password must match",
    path: ["confirm_new_password"]
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
