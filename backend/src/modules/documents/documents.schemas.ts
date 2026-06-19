import { z } from "zod";

export const bookingDocumentParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict();

export const cancellationCaseParamsSchema = z
  .object({
    id: z.string().uuid()
  })
  .strict();
