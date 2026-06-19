import { z } from "zod";

const BRUNEI_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

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

function getCurrentMonthRange(): { from: string; to: string } {
  const bruneiNow = new Date(Date.now() + BRUNEI_OFFSET_MILLISECONDS);
  const year = bruneiNow.getUTCFullYear();
  const month = bruneiNow.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month + 1, 0))
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

const dateSchema = z
  .string()
  .regex(DATE_PATTERN, "Date must use YYYY-MM-DD format")
  .refine(isValidCalendarDate, "Date must be a valid calendar date");

export const reportQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional()
  })
  .strict()
  .superRefine((input, context) => {
    if ((input.from && !input.to) || (!input.from && input.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both from and to dates are required when filtering"
      });
      return;
    }

    if (!input.from || !input.to) {
      return;
    }

    const fromTime = Date.parse(`${input.from}T00:00:00Z`);
    const toTime = Date.parse(`${input.to}T00:00:00Z`);
    if (fromTime > toTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "To date must be on or after from date"
      });
      return;
    }

    const inclusiveDays = (toTime - fromTime) / DAY_MILLISECONDS + 1;
    if (inclusiveDays > 366) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Report date range cannot exceed 366 days"
      });
    }
  })
  .transform((input) => {
    if (input.from && input.to) {
      return { from: input.from, to: input.to };
    }
    return getCurrentMonthRange();
  });

export type ReportDateRange = z.infer<typeof reportQuerySchema>;
