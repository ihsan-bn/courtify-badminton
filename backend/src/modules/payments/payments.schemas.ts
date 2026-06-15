import { z } from "zod";

export const createCheckoutSessionSchema = z
  .object({
    booking_id: z.string().uuid()
  })
  .strict();

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;

export const retryCheckoutSessionSchema = createCheckoutSessionSchema;

export type RetryCheckoutSessionInput = z.infer<
  typeof retryCheckoutSessionSchema
>;
