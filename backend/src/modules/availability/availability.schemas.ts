import { z } from "zod";

const BRUNEI_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000;

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function getCurrentBruneiDate(): string {
  return new Date(Date.now() + BRUNEI_OFFSET_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

export const availabilityQuerySchema = z
  .object({
    court_id: z.string().uuid(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
      .refine(isValidCalendarDate, "Date must be a valid calendar date")
      .refine(
        (date) => date >= getCurrentBruneiDate(),
        "Date cannot be in the past"
      )
  })
  .strict();

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
