import { z } from "zod";

const BRUNEI_OFFSET = "+08:00";

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

export function createBruneiSlotDateTime(
  slotDate: string,
  startHour: number
): Date {
  return new Date(
    `${slotDate}T${startHour.toString().padStart(2, "0")}:00:00${BRUNEI_OFFSET}`
  );
}

export const createBookingLockSchema = z
  .object({
    court_id: z.string().uuid(),
    slot_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
      .refine(isValidCalendarDate, "Date must be a valid calendar date"),
    start_hour: z.number().int().min(8).max(21),
    duration_hours: z.number().int().min(1).max(14)
  })
  .strict()
  .superRefine((input, context) => {
    if (input.start_hour + input.duration_hours > 22) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_hours"],
        message: "Booking must end no later than 22:00"
      });
    }

    const reservationStart = createBruneiSlotDateTime(
      input.slot_date,
      input.start_hour
    );
    if (reservationStart.getTime() <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slot_date"],
        message: "Past dates or times cannot be booked"
      });
    }
  });

export type CreateBookingLockInput = z.infer<typeof createBookingLockSchema>;

export const bookingStatuses = [
  "locked",
  "confirmed",
  "cancellation_requested",
  "cancelled",
  "expired"
] as const;

export const adminBookingsQuerySchema = z
  .object({
    status: z.enum(bookingStatuses).optional(),
    court_id: z.string().uuid().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
      .refine(isValidCalendarDate, "Date must be a valid calendar date")
      .optional()
  })
  .strict();

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;

export const cancelBookingParamsSchema = z
  .object({
    bookingId: z.string().uuid()
  })
  .strict();

export const cancelBookingBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(1000).nullable().optional()
  })
  .strict();

export type CancelBookingInput = z.infer<typeof cancelBookingBodySchema>;
