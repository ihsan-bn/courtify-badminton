import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === (month ?? 1) - 1 &&
    parsed.getUTCDate() === day
  );
}

const optionalDate = z
  .string()
  .regex(DATE_PATTERN, "Date must use YYYY-MM-DD format")
  .refine(isValidCalendarDate, "Date must be a valid calendar date")
  .optional();

export const auditLogsQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(100).optional(),
    actor_user_id: z.string().uuid().optional(),
    entity_type: z.string().trim().min(1).max(100).optional(),
    entity_id: z.string().uuid().optional(),
    from: optionalDate,
    to: optionalDate,
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict()
  .superRefine((input, context) => {
    if (input.from && input.to && input.from > input.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "To date must be on or after from date"
      });
    }
  });

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
