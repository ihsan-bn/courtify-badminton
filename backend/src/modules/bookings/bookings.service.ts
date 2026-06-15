import { DatabaseError } from "pg";

import { withTransaction } from "../../config/database.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError
} from "../../utils/errors.js";
import {
  calculateBookingTotalBnd,
  calculateSlotPriceBnd
} from "../../utils/pricing.js";
import {
  bookingsRepository,
  type AdminCancellationRequestRecord,
  type BookingHistoryRow,
  type BookingSlotStatus,
  type BookingStatus,
  type LockedBookingRecord
} from "./bookings.repository.js";
import {
  type AdminBookingsQuery,
  type CancelBookingInput,
  createBruneiSlotDateTime,
  type CreateBookingLockInput
} from "./bookings.schemas.js";

interface BookingLockResult {
  booking_id: string;
  status: "locked";
  court_id: string;
  slot_date: string;
  start_hour: number;
  duration_hours: number;
  reservation_start_at: string;
  reservation_end_at: string;
  total_amount_bnd: string;
  lock_expires_at: string;
}

interface BookingHistorySlot {
  slot_date: string;
  start_hour: number;
  end_hour: number;
  status: BookingSlotStatus;
  price_bnd: string;
}

interface CustomerBookingHistoryItem {
  booking_id: string;
  status: BookingStatus;
  court_id: string;
  court_name: string;
  court_location: string;
  total_amount_bnd: string;
  reservation_start_at: string;
  reservation_end_at: string;
  lock_expires_at: string | null;
  created_at: string;
  slots: BookingHistorySlot[];
}

interface AdminBookingHistoryItem extends CustomerBookingHistoryItem {
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
}

interface CancellationResult {
  cancellation_request_id: string;
  booking_id: string;
  status: "cancellation_requested";
  cancellation_request_status: "pending_admin_review";
  reason: string | null;
  created_at: string;
}

interface AdminCancellationRequestResult {
  cancellation_request_id: string;
  booking_id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
  court_id: string;
  court_name: string;
  court_location: string;
  reservation_start_at: string;
  reservation_end_at: string;
  total_amount_bnd: string;
  reason: string | null;
  status: "pending_admin_review" | "refund_completed" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

function isSlotConflict(error: unknown): boolean {
  return (
    error instanceof DatabaseError &&
    error.code === "23505" &&
    error.constraint === "booking_slots_court_date_hour_key"
  );
}

function formatResult(
  booking: LockedBookingRecord,
  input: CreateBookingLockInput
): BookingLockResult {
  return {
    booking_id: booking.id,
    status: booking.status,
    court_id: booking.court_id,
    slot_date: input.slot_date,
    start_hour: input.start_hour,
    duration_hours: input.duration_hours,
    reservation_start_at: booking.reservation_start_at.toISOString(),
    reservation_end_at: booking.reservation_end_at.toISOString(),
    total_amount_bnd: booking.total_amount_bnd,
    lock_expires_at: booking.lock_expires_at.toISOString()
  };
}

function formatSlot(row: BookingHistoryRow): BookingHistorySlot | null {
  if (
    row.slot_date === null ||
    row.start_hour === null ||
    row.slot_status === null
  ) {
    return null;
  }

  return {
    slot_date: row.slot_date,
    start_hour: row.start_hour,
    end_hour: row.start_hour + 1,
    status: row.slot_status,
    price_bnd: calculateSlotPriceBnd(
      row.slot_date,
      row.start_hour
    ).toFixed(2)
  };
}

function groupCustomerBookings(
  rows: BookingHistoryRow[]
): CustomerBookingHistoryItem[] {
  const bookings = new Map<string, CustomerBookingHistoryItem>();

  for (const row of rows) {
    let booking = bookings.get(row.booking_id);
    if (!booking) {
      booking = {
        booking_id: row.booking_id,
        status: row.booking_status,
        court_id: row.court_id,
        court_name: row.court_name,
        court_location: row.court_location,
        total_amount_bnd: row.total_amount_bnd,
        reservation_start_at: row.reservation_start_at.toISOString(),
        reservation_end_at: row.reservation_end_at.toISOString(),
        lock_expires_at: row.lock_expires_at?.toISOString() ?? null,
        created_at: row.created_at.toISOString(),
        slots: []
      };
      bookings.set(row.booking_id, booking);
    }

    const slot = formatSlot(row);
    if (slot) {
      booking.slots.push(slot);
    }
  }

  return [...bookings.values()];
}

function groupAdminBookings(
  rows: BookingHistoryRow[]
): AdminBookingHistoryItem[] {
  const customerBookings = groupCustomerBookings(rows);
  const customerDetails = new Map(
    rows.map((row) => [
      row.booking_id,
      {
        user_id: row.user_id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        customer_phone_number: row.customer_phone_number
      }
    ])
  );

  return customerBookings.map((booking) => {
    const details = customerDetails.get(booking.booking_id);
    if (!details) {
      throw new Error("Booking customer details are unavailable");
    }

    return {
      ...booking,
      ...details
    };
  });
}

function formatCancellationRequest(
  request: AdminCancellationRequestRecord
): AdminCancellationRequestResult {
  return {
    cancellation_request_id: request.cancellation_request_id,
    booking_id: request.booking_id,
    user_id: request.user_id,
    customer_name: request.customer_name,
    customer_email: request.customer_email,
    customer_phone_number: request.customer_phone_number,
    court_id: request.court_id,
    court_name: request.court_name,
    court_location: request.court_location,
    reservation_start_at: request.reservation_start_at.toISOString(),
    reservation_end_at: request.reservation_end_at.toISOString(),
    total_amount_bnd: request.total_amount_bnd,
    reason: request.reason,
    status: request.status,
    created_at: request.created_at.toISOString(),
    reviewed_at: request.reviewed_at?.toISOString() ?? null,
    reviewed_by: request.reviewed_by
  };
}

export const bookingsService = {
  async createLock(
    userId: string,
    input: CreateBookingLockInput
  ): Promise<BookingLockResult> {
    const reservationStartAt = createBruneiSlotDateTime(
      input.slot_date,
      input.start_hour
    );
    const reservationEndAt = createBruneiSlotDateTime(
      input.slot_date,
      input.start_hour + input.duration_hours
    );
    const totalAmountBnd = calculateBookingTotalBnd(
      input.slot_date,
      input.start_hour,
      input.duration_hours
    ).toFixed(2);
    const startHours = Array.from(
      { length: input.duration_hours },
      (_, index) => input.start_hour + index
    );

    try {
      const booking = await withTransaction(async (client) => {
        const court = await bookingsRepository.findActiveCourt(
          client,
          input.court_id
        );
        if (!court) {
          throw new NotFoundError("Active court not found");
        }

        const expiredBookingIds =
          await bookingsRepository.findExpiredOverlappingLockIds(
            client,
            input.court_id,
            input.slot_date,
            startHours
          );
        await bookingsRepository.deleteSlotsForExpiredBookings(
          client,
          expiredBookingIds
        );
        await bookingsRepository.markBookingsExpired(
          client,
          expiredBookingIds
        );

        const lockedBooking = await bookingsRepository.createLockedBooking(
          client,
          userId,
          input.court_id,
          totalAmountBnd,
          reservationStartAt,
          reservationEndAt
        );

        await bookingsRepository.createLockedSlots(
          client,
          lockedBooking.id,
          input.court_id,
          input.slot_date,
          startHours
        );

        return lockedBooking;
      });

      return formatResult(booking, input);
    } catch (error) {
      if (isSlotConflict(error)) {
        throw new ConflictError(
          "One or more requested court slots are no longer available"
        );
      }
      throw error;
    }
  },

  async getCustomerHistory(
    userId: string
  ): Promise<CustomerBookingHistoryItem[]> {
    const rows = await bookingsRepository.findCustomerBookings(userId);
    return groupCustomerBookings(rows);
  },

  async getAdminBookings(
    filters: AdminBookingsQuery
  ): Promise<AdminBookingHistoryItem[]> {
    const rows = await bookingsRepository.findAdminBookings(filters);
    return groupAdminBookings(rows);
  },

  async cancelBooking(
    userId: string,
    bookingId: string,
    input: CancelBookingInput
  ): Promise<CancellationResult> {
    try {
      return await withTransaction(async (client) => {
        const booking = await bookingsRepository.findBookingForCancellation(
          client,
          bookingId
        );

        if (!booking) {
          throw new NotFoundError("Booking not found");
        }
        if (booking.user_id !== userId) {
          throw new ForbiddenError("Booking belongs to another customer");
        }
        if (booking.status !== "confirmed") {
          throw new ConflictError("Only confirmed bookings can be cancelled");
        }
        if (
          booking.reservation_start_at.getTime() <
          Date.now() + 24 * 60 * 60 * 1000
        ) {
          throw new ConflictError(
            "Cancellation requires at least 24 hours notice"
          );
        }

        // Insert while the booking is confirmed to satisfy the DB trigger.
        const cancellationRequest =
          await bookingsRepository.createCancellationRequest(
            client,
            bookingId,
            userId,
            input.reason ?? null
          );

        await bookingsRepository.markBookingCancellationRequested(
          client,
          bookingId
        );
        await bookingsRepository.releaseBookingSlots(client, bookingId);

        return {
          cancellation_request_id: cancellationRequest.id,
          booking_id: cancellationRequest.booking_id,
          status: "cancellation_requested",
          cancellation_request_status: cancellationRequest.status,
          reason: cancellationRequest.reason,
          created_at: cancellationRequest.created_at.toISOString()
        };
      });
    } catch (error) {
      if (error instanceof DatabaseError && error.code === "23514") {
        throw new ConflictError(
          "Booking is no longer eligible for cancellation"
        );
      }
      throw error;
    }
  },

  async getCancellationRequests(): Promise<
    AdminCancellationRequestResult[]
  > {
    const requests = await bookingsRepository.findCancellationRequests();
    return requests.map(formatCancellationRequest);
  }
};
