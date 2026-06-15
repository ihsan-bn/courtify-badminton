const OPENING_HOUR = 8;
const LAST_START_HOUR = 21;

function parseDateParts(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new RangeError("Date must use YYYY-MM-DD format");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError("Date must be a valid calendar date");
  }

  return { year, month, day };
}

function assertValidStartHour(startHour: number): void {
  if (
    !Number.isInteger(startHour) ||
    startHour < OPENING_HOUR ||
    startHour > LAST_START_HOUR
  ) {
    throw new RangeError("Start hour must be an integer from 8 through 21");
  }
}

export function calculateSlotPriceBnd(
  date: string,
  startHour: number
): number {
  const { year, month, day } = parseDateParts(date);
  assertValidStartHour(startHour);

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (!isWeekend) {
    return 10;
  }

  return startHour < 18 ? 11 : 12;
}

export function calculateBookingTotalBnd(
  date: string,
  startHour: number,
  durationHours: number
): number {
  assertValidStartHour(startHour);

  if (!Number.isInteger(durationHours) || durationHours < 1) {
    throw new RangeError("Duration must be a positive whole number of hours");
  }

  if (startHour + durationHours > 22) {
    throw new RangeError("Booking must end by 22:00");
  }

  let total = 0;
  for (let offset = 0; offset < durationHours; offset += 1) {
    total += calculateSlotPriceBnd(date, startHour + offset);
  }

  return total;
}
