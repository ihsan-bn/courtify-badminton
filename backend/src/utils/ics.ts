interface BookingCalendarInviteInput {
  bookingId: string;
  courtName: string;
  customerEmail: string | null;
  organizerEmail: string | null;
  reservationStartAt: Date;
  reservationEndAt: Date;
  totalAmountBnd: string;
}

const calendarTimezone = "Asia/Brunei";

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatUtcDateTime(value: Date): string {
  return [
    value.getUTCFullYear().toString(),
    pad(value.getUTCMonth() + 1),
    pad(value.getUTCDate()),
    "T",
    pad(value.getUTCHours()),
    pad(value.getUTCMinutes()),
    pad(value.getUTCSeconds()),
    "Z"
  ].join("");
}

function getBruneiDateParts(value: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: calendarTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);

  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: partMap.get("year") ?? "1970",
    month: partMap.get("month") ?? "01",
    day: partMap.get("day") ?? "01",
    hour: partMap.get("hour") ?? "00",
    minute: partMap.get("minute") ?? "00",
    second: partMap.get("second") ?? "00"
  };
}

function formatBruneiDateTime(value: Date): string {
  const parts = getBruneiDateParts(value);
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function formatDisplayDate(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: calendarTimezone,
    dateStyle: "full"
  }).format(value);
}

function formatDisplayTime(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: calendarTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(value);
}

function durationHours(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000));
}

function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) {
    return line;
  }

  const chunks: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }
  chunks.push(remaining);

  return chunks
    .map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`))
    .join("\r\n");
}

function getEmailAddress(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const displayNameMatch = /<([^<>]+)>$/.exec(value);
  return displayNameMatch?.[1] ?? value;
}

export function createBookingCalendarInvite(
  input: BookingCalendarInviteInput
): string {
  const duration = durationHours(
    input.reservationStartAt,
    input.reservationEndAt
  );
  const organizerEmail = getEmailAddress(input.organizerEmail);
  const description = [
    `Booking ID: ${input.bookingId}`,
    `Court: ${input.courtName}`,
    `Date: ${formatDisplayDate(input.reservationStartAt)}`,
    `Start time: ${formatDisplayTime(input.reservationStartAt)}`,
    `End time: ${formatDisplayTime(input.reservationEndAt)}`,
    `Duration: ${duration.toString()} hour(s)`,
    `Total amount: BND ${input.totalAmountBnd}`,
    "Status: confirmed",
    "Note: Please arrive 10 minutes before your booking time."
  ].join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Courtify-Badminton//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VTIMEZONE",
    `TZID:${calendarTimezone}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:BNT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${escapeText(input.bookingId)}@courtify-badminton`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART;TZID=${calendarTimezone}:${formatBruneiDateTime(input.reservationStartAt)}`,
    `DTEND;TZID=${calendarTimezone}:${formatBruneiDateTime(input.reservationEndAt)}`,
    `SUMMARY:${escapeText(`Courtify-Badminton Booking - ${input.courtName}`)}`,
    "LOCATION:Courtify-Badminton\\, Brunei Darussalam",
    `DESCRIPTION:${escapeText(description)}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    ...(organizerEmail
      ? [`ORGANIZER;CN=Courtify-Badminton:mailto:${organizerEmail}`]
      : []),
    ...(input.customerEmail
      ? [
          `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${input.customerEmail}`
        ]
      : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Courtify-Badminton booking starts in 30 minutes.",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
