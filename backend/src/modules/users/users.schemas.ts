import { z } from "zod";

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: z.string().trim().toLowerCase().email().max(254)
  })
  .strict();

export type OnboardingInput = z.infer<typeof onboardingSchema>;
