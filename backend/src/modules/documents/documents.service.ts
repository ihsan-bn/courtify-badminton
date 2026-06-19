import {
  ConflictError,
  NotFoundError
} from "../../utils/errors.js";
import {
  type BookingDocumentRecord,
  documentsRepository
} from "./documents.repository.js";
import { generateCourtifyPdf } from "./pdf.service.js";

interface GeneratedDocument {
  filename: string;
  content: Buffer;
}

const BRUNEI_TIME_ZONE = "Asia/Brunei";

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: BRUNEI_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: BRUNEI_TIME_ZONE,
    dateStyle: "long"
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: BRUNEI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(value);
}

function formatStatus(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBnd(value: string): string {
  return `BND ${Number.parseFloat(value).toFixed(2)}`;
}

function getGeneratedAt(): string {
  return formatDateTime(new Date());
}

function getDurationHours(booking: BookingDocumentRecord): number {
  return Math.max(
    1,
    Math.round(
      (booking.reservation_end_at.getTime() -
        booking.reservation_start_at.getTime()) /
        3_600_000
    )
  );
}

function getTimeSlots(booking: BookingDocumentRecord): string {
  const durationHours = getDurationHours(booking);
  const slots = Array.from({ length: durationHours }, (_, index) => {
    const start = new Date(
      booking.reservation_start_at.getTime() + index * 3_600_000
    );
    const end = new Date(start.getTime() + 3_600_000);
    return `${formatTime(start)} - ${formatTime(end)}`;
  });

  return slots.join(", ");
}

function requireCustomerBooking(
  booking: BookingDocumentRecord | null
): BookingDocumentRecord {
  if (!booking) {
    throw new NotFoundError("Booking not found");
  }
  return booking;
}

export const documentsService = {
  async generateBookingReceipt(
    bookingId: string,
    userId: string
  ): Promise<GeneratedDocument> {
    const booking = requireCustomerBooking(
      await documentsRepository.findCustomerBooking(bookingId, userId)
    );

    if (booking.booking_status === "locked" || booking.booking_status === "expired") {
      throw new ConflictError(
        "A booking receipt is available only for paid bookings"
      );
    }

    return {
      filename: `courtify-booking-receipt-${booking.booking_id}.pdf`,
      content: generateCourtifyPdf({
        title: "Booking Receipt",
        reference: booking.booking_id,
        generatedAt: getGeneratedAt(),
        sections: [
          {
            heading: "Customer",
            rows: [
              {
                label: "Name",
                value: booking.customer_name ?? "Not provided"
              }
            ]
          },
          {
            heading: "Booking",
            rows: [
              { label: "Booking ID", value: booking.booking_id },
              { label: "Court", value: booking.court_name },
              { label: "Location", value: booking.court_location },
              {
                label: "Date",
                value: formatDate(booking.reservation_start_at)
              },
              { label: "Time slots", value: getTimeSlots(booking) },
              {
                label: "Duration",
                value: `${getDurationHours(booking).toString()} hour(s)`
              },
              {
                label: "Total amount",
                value: formatBnd(booking.total_amount_bnd)
              },
              {
                label: "Booking status",
                value: formatStatus(booking.booking_status)
              }
            ]
          }
        ]
      })
    };
  },

  async generateCancellationReceipt(
    bookingId: string,
    userId: string
  ): Promise<GeneratedDocument> {
    const booking = requireCustomerBooking(
      await documentsRepository.findCustomerBooking(bookingId, userId)
    );

    if (
      !booking.cancellation_request_id ||
      !booking.cancellation_status ||
      !booking.cancellation_created_at
    ) {
      throw new NotFoundError(
        "Cancellation receipt is not available for this booking"
      );
    }

    return {
      filename: `courtify-cancellation-receipt-${booking.booking_id}.pdf`,
      content: generateCourtifyPdf({
        title: "Cancellation Receipt",
        reference: booking.cancellation_request_id,
        generatedAt: getGeneratedAt(),
        sections: [
          {
            heading: "Booking",
            rows: [
              { label: "Booking ID", value: booking.booking_id },
              {
                label: "Customer",
                value: booking.customer_name ?? "Not provided"
              },
              { label: "Court", value: booking.court_name },
              {
                label: "Reservation",
                value: `${formatDateTime(booking.reservation_start_at)} - ${formatTime(
                  booking.reservation_end_at
                )}`
              }
            ]
          },
          {
            heading: "Cancellation",
            rows: [
              {
                label: "Request date",
                value: formatDateTime(booking.cancellation_created_at)
              },
              {
                label: "Approval date",
                value: booking.cancellation_reviewed_at
                  ? formatDateTime(booking.cancellation_reviewed_at)
                  : "Pending admin approval"
              },
              {
                label: "Status",
                value: formatStatus(booking.cancellation_status)
              }
            ]
          }
        ]
      })
    };
  },

  async generateRefundReceipt(
    bookingId: string,
    userId: string
  ): Promise<GeneratedDocument> {
    const booking = requireCustomerBooking(
      await documentsRepository.findCustomerBooking(bookingId, userId)
    );

    if (
      !booking.refunded_at ||
      !booking.refund_method ||
      !booking.refund_reference ||
      !booking.cancellation_status
    ) {
      throw new NotFoundError(
        "Refund receipt is not available for this booking"
      );
    }

    return {
      filename: `courtify-refund-receipt-${booking.booking_id}.pdf`,
      content: generateCourtifyPdf({
        title: "Refund Receipt",
        reference: booking.refund_reference,
        generatedAt: getGeneratedAt(),
        sections: [
          {
            heading: "Refund",
            rows: [
              { label: "Booking ID", value: booking.booking_id },
              {
                label: "Refund amount",
                value: formatBnd(booking.total_amount_bnd)
              },
              { label: "Refund method", value: booking.refund_method },
              { label: "Refund reference", value: booking.refund_reference },
              {
                label: "Completion date",
                value: formatDateTime(booking.refunded_at)
              },
              {
                label: "Case status",
                value: formatStatus(booking.cancellation_status)
              }
            ]
          }
        ]
      })
    };
  },

  async generateCancellationCaseSummary(
    requestId: string
  ): Promise<GeneratedDocument> {
    const booking = await documentsRepository.findCancellationCase(requestId);
    if (!booking?.cancellation_request_id) {
      throw new NotFoundError("Cancellation request not found");
    }

    const events =
      await documentsRepository.findCancellationEvents(requestId);

    return {
      filename: `courtify-cancellation-case-${requestId}.pdf`,
      content: generateCourtifyPdf({
        title: "Cancellation Case Summary",
        reference: requestId,
        generatedAt: getGeneratedAt(),
        sections: [
          {
            heading: "Customer",
            rows: [
              {
                label: "Name",
                value: booking.customer_name ?? "Not provided"
              },
              {
                label: "Phone",
                value: booking.customer_phone_number
              },
              {
                label: "Email",
                value: booking.customer_email ?? "Not provided"
              }
            ]
          },
          {
            heading: "Booking",
            rows: [
              { label: "Booking ID", value: booking.booking_id },
              { label: "Court", value: booking.court_name },
              { label: "Location", value: booking.court_location },
              {
                label: "Reservation",
                value: `${formatDateTime(booking.reservation_start_at)} - ${formatTime(
                  booking.reservation_end_at
                )}`
              },
              { label: "Time slots", value: getTimeSlots(booking) },
              {
                label: "Amount",
                value: formatBnd(booking.total_amount_bnd)
              },
              {
                label: "Booking status",
                value: formatStatus(booking.booking_status)
              }
            ]
          },
          {
            heading: "Cancellation Outcome",
            rows: [
              {
                label: "Requested",
                value: booking.cancellation_created_at
                  ? formatDateTime(booking.cancellation_created_at)
                  : "Not recorded"
              },
              {
                label: "Reviewed",
                value: booking.cancellation_reviewed_at
                  ? formatDateTime(booking.cancellation_reviewed_at)
                  : "Not reviewed"
              },
              {
                label: "Final outcome",
                value: booking.cancellation_status
                  ? formatStatus(booking.cancellation_status)
                  : "Not recorded"
              }
            ]
          },
          {
            heading: "Timeline",
            rows:
              events.length > 0
                ? events.map((event) => ({
                    label: formatDateTime(event.created_at),
                    value: `${formatStatus(event.event_type)}: ${event.message}`
                  }))
                : [{ label: "Events", value: "No timeline events recorded" }]
          },
          {
            heading: "Refund",
            rows: [
              {
                label: "Status",
                value: booking.refunded_at ? "Completed" : "Not completed"
              },
              {
                label: "Method",
                value: booking.refund_method ?? "Not recorded"
              },
              {
                label: "Reference",
                value: booking.refund_reference ?? "Not recorded"
              },
              {
                label: "Completed",
                value: booking.refunded_at
                  ? formatDateTime(booking.refunded_at)
                  : "Not completed"
              },
              {
                label: "Admin notes",
                value: booking.refund_notes ?? "Not recorded"
              }
            ]
          }
        ]
      })
    };
  }
};
