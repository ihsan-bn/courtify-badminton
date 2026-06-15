import { z } from "zod";

const courtName = z.string().trim().min(1).max(100);
const courtLocation = z.string().trim().min(1).max(255);

export const courtIdParamsSchema = z
  .object({
    courtId: z.string().uuid()
  })
  .strict();

export const createCourtSchema = z
  .object({
    name: courtName,
    location: courtLocation,
    active: z.boolean()
  })
  .strict();

export const updateCourtSchema = z
  .object({
    name: courtName.optional(),
    location: courtLocation.optional(),
    active: z.boolean().optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one court field must be supplied"
  });

export type CreateCourtInput = z.infer<typeof createCourtSchema>;
export type UpdateCourtInput = z.infer<typeof updateCourtSchema>;
