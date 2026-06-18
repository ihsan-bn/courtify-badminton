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
  type AdminCancellationRequestDetailRecord,
  type AdminCancellationSlotRecord,
  type BookingHistoryRow,
  type BookingSlotStatus,
  type BookingStatus,
  type CustomerCancellationTimelineRow,
  type LockedBookingRecord
} from "./bookings.repository.js";
import {
  type AdminCancellationActionInput,
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

interface CustomerCancellationTimelineEvent {
  event_id: string;
  event_type: string;
  message: string;
  actor_type: "customer" | "admin" | "system";
  created_at: string;
}

interface CustomerCancellationRequest {
  cancellation_request_id: string;
  status:
    | "pending_admin_review"
    | "approved"
    | "refund_completed"
    | "rejected";
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  timeline: CustomerCancellationTimelineEvent[];
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
  cancellation_request: CustomerCancellationRequest | null;
}

interface AdminBookingHistoryItem extends CustomerBookingHistoryItem {
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
}

interface CancellationResult {
  booking_id: string;
  status: "cancellation_requested" | "cancelled";
  cancellation_request_id: string | null;
  reason: string | null;
}

interface AdminCancellationRequestResult {
  request_id: string;
  cancellation_request_id: string;
  booking_id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
  customer_phone: string;
  court_id: string;
  court_name: string;
  court_location: string;
  reservation_start_at: string;
  reservation_end_at: string;
  total_amount_bnd: string;
  reason: string | null;
  status:
    | "pending_admin_review"
    | "approved"
    | "refund_completed"
    | "rejected";
  current_cancellation_status:
    | "pending_admin_review"
    | "approved"
    | "refund_completed"
    | "rejected";
  booking_date: string;
  requested_at: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface AdminCancellationSlot {
  slot_date: string;
  start_hour: number;
  end_hour: number;
  status: BookingSlotStatus;
  price_bnd: string;
}

interface AdminCancellationEvent {
  event_id: string;
  event_type: string;
  message: string;
  actor_type: "customer" | "admin" | "system";
  actor_user_id: string | null;
  created_at: string;
}

interface AdminCancellationDetailResult
  extends AdminCancellationRequestResult {
  booking_status: BookingStatus;
  slots: AdminCancellationSlot[];
  timeline: AdminCancellationEvent[];
}

interface AdminCancellationActionResult {
  cancellation_request_id: string;
  booking_id: string;
  booking_status: BookingStatus;
  cancellation_status:
    | "pending_admin_review"
    | "approved"
    | "refund_completed"
    | "rejected";
  action: AdminCancellationActionInput["action"];
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
  rows: BookingHistoryRow[],
  cancellationRows: CustomerCancellationTimelineRow[] = []
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
        slots: [],
        cancellation_request: null
      };
      bookings.set(row.booking_id, booking);
    }

    const slot = formatSlot(row);
    if (slot) {
      booking.slots.push(slot);
    }
  }

  const cancellationRequests = new Map<
    string,
    CustomerCancellationRequest
  >();

  for (const row of cancellationRows) {
    let cancellationRequest = cancellationRequests.get(row.booking_id);
    if (
      cancellationRequest?.cancellation_request_id !==
        row.cancellation_request_id
    ) {
      cancellationRequest = {
        cancellation_request_id: row.cancellation_request_id,
        status: row.cancellation_status,
        reason: row.cancellation_reason,
        created_at: row.cancellation_created_at.toISOString(),
        reviewed_at:
          row.cancellation_reviewed_at?.toISOString() ?? null,
        reviewed_by: row.cancellation_reviewed_by,
        timeline: []
      };
      cancellationRequests.set(row.booking_id, cancellationRequest);
    }

    if (
      row.event_id &&
      row.event_type &&
      row.event_message &&
      row.event_actor_type &&
      row.event_created_at
    ) {
      cancellationRequest.timeline.push({
        event_id: row.event_id,
        event_type: row.event_type,
        message: row.event_message,
        actor_type: row.event_actor_type,
        created_at: row.event_created_at.toISOString()
      });
    }
  }

  for (const [bookingId, cancellationRequest] of cancellationRequests) {
    const booking = bookings.get(bookingId);
    if (booking) {
      booking.cancellation_request = cancellationRequest;
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
  const requestedAt = request.created_at.toISOString();

  return {
    request_id: request.cancellation_request_id,
    cancellation_request_id: request.cancellation_request_id,
    booking_id: request.booking_id,
    user_id: request.user_id,
    customer_name: request.customer_name,
    customer_email: request.customer_email,
    customer_phone_number: request.customer_phone_number,
    customer_phone: request.customer_phone_number,
    court_id: request.court_id,
    court_name: request.court_name,
    court_location: request.court_location,
    reservation_start_at: request.reservation_start_at.toISOString(),
    reservation_end_at: request.reservation_end_at.toISOString(),
    total_amount_bnd: request.total_amount_bnd,
    reason: request.reason,
    status: request.status,
    current_cancellation_status: request.status,
    booking_date: request.reservation_start_at.toISOString().slice(0, 10),
    requested_at: requestedAt,
    created_at: requestedAt,
    reviewed_at: request.reviewed_at?.toISOString() ?? null,
    reviewed_by: request.reviewed_by
  };
}

function formatAdminCancellationSlot(
  slot: AdminCancellationSlotRecord
): AdminCancellationSlot {
  return {
    slot_date: slot.slot_date,
    start_hour: slot.start_hour,
    end_hour: slot.start_hour + 1,
    status: slot.status,
    price_bnd: calculateSlotPriceBnd(
      slot.slot_date,
      slot.start_hour
    ).toFixed(2)
  };
}

function formatAdminCancellationDetail(
  request: AdminCancellationRequestDetailRecord,
  slots: AdminCancellationSlotRecord[],
  timeline: Awaited<
    ReturnType<typeof bookingsRepository.findCancellationRequestEvents>
  >
): AdminCancellationDetailResult {
  return {
    ...formatCancellationRequest(request),
    booking_status: request.booking_status,
    slots: slots.map(formatAdminCancellationSlot),
    timeline: timeline.map((event) => ({
      event_id: event.event_id,
      event_type: event.event_type,
      message: event.message,
      actor_type: event.actor_type,
      actor_user_id: event.actor_user_id,
      created_at: event.created_at.toISOString()
    }))
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
    const [rows, cancellationRows] = await Promise.all([
      bookingsRepository.findCustomerBookings(userId),
      bookingsRepository.findCustomerCancellationTimeline(userId)
    ]);
    return groupCustomerBookings(rows, cancellationRows);
  },

  async getAdminBookings(
    filters: AdminBookingsQuery
  ): Promise<AdminBookingHistoryItem[]> {
    const rows = await bookingsRepository.findAdminBookings(filters);
    return groupAdminBookings(rows);
  },

  async cancelBooking(
    actorUserId: string,
    isAdmin: boolean,
    bookingId: string,
    input: CancelBookingInput
  ): Promise<CancellationResult> {
    return withTransaction(async (client) => {
      const booking = await bookingsRepository.findBookingForCancellation(
        client,
        bookingId
      );

      if (!booking) {
        throw new NotFoundError("Booking not found");
      }
      if (!isAdmin && booking.user_id !== actorUserId) {
        throw new ForbiddenError("Booking belongs to another customer");
      }

      const existingCancellationRequest =
        await bookingsRepository.findCancellationRequestByBooking(
          client,
          bookingId
        );
      if (booking.status === "cancelled") {
        return {
          booking_id: booking.id,
          status: "cancelled",
          cancellation_request_id:
            existingCancellationRequest?.id ?? null,
          reason: input.reason ?? null
        };
      }
      if (
        booking.status === "cancellation_requested" &&
        existingCancellationRequest
      ) {
        return {
          booking_id: booking.id,
          status: "cancellation_requested",
          cancellation_request_id: existingCancellationRequest.id,
          reason: existingCancellationRequest.reason
        };
      }
      if (booking.status !== "confirmed") {
        throw new ConflictError("Only confirmed bookings can be cancelled");
      }
      if (
        booking.reservation_start_at.getTime() <
        Date.now() + 24 * 60 * 60 * 1000
      ) {
        throw new ConflictError(
          "Cancellation is unavailable within 24 hours of the booking start time"
        );
      }
      const cancellationRequest =
        existingCancellationRequest ??
        (await bookingsRepository.createCancellationRequest(
          client,
          booking.id,
          booking.user_id,
          input.reason ?? null
        ));

      await bookingsRepository.createCancellationRequestEvent(
        client,
        cancellationRequest.id,
        booking.id,
        isAdmin
          ? "admin_requested_cancellation"
          : "customer_requested_cancellation",
        isAdmin
          ? "Administrator requested cancellation."
          : "Customer requested cancellation.",
        isAdmin ? "admin" : "customer",
        actorUserId
      );
      await bookingsRepository.createCancellationRequestEvent(
        client,
        cancellationRequest.id,
        booking.id,
        "pending_admin_review",
        "Cancellation request is pending admin review.",
        "system",
        null
      );

      await bookingsRepository.markBookingCancellationRequested(
        client,
        booking.id
      );

      return {
        booking_id: booking.id,
        status: "cancellation_requested",
        cancellation_request_id: cancellationRequest.id,
        reason: input.reason ?? null
      };
    });
  },

  async getCancellationRequests(): Promise<
    AdminCancellationRequestResult[]
  > {
    const requests = await bookingsRepository.findCancellationRequests();
    return requests.map(formatCancellationRequest);
  },

  async getCancellationRequestDetail(
    requestId: string
  ): Promise<AdminCancellationDetailResult> {
    const request =
      await bookingsRepository.findCancellationRequestDetail(requestId);
    if (!request) {
      throw new NotFoundError("Cancellation request not found");
    }

    const [slots, timeline] = await Promise.all([
      bookingsRepository.findCancellationRequestSlots(request.booking_id),
      bookingsRepository.findCancellationRequestEvents(requestId)
    ]);

    return formatAdminCancellationDetail(request, slots, timeline);
  },

  async addCancellationAction(
    adminUserId: string,
    requestId: string,
    input: AdminCancellationActionInput
  ): Promise<AdminCancellationActionResult> {
    return withTransaction(async (client) => {
      const request =
        await bookingsRepository.findCancellationRequestForUpdate(
          client,
          requestId
        );
      if (!request) {
        throw new NotFoundError("Cancellation request not found");
      }

      if (input.action === "admin_verifying_cancellation") {
        if (request.status !== "pending_admin_review") {
          throw new ConflictError(
            "Only pending cancellation requests can be updated"
          );
        }
        await bookingsRepository.createCancellationRequestEvent(
          client,
          request.id,
          request.booking_id,
          input.action,
          "Administrator is verifying the cancellation.",
          "admin",
          adminUserId
        );
        return {
          cancellation_request_id: request.id,
          booking_id: request.booking_id,
          booking_status: request.booking_status,
          cancellation_status: request.status,
          action: input.action
        };
      }

      if (input.action === "customer_contacted") {
        if (request.status !== "pending_admin_review") {
          throw new ConflictError(
            "Only pending cancellation requests can be updated"
          );
        }
        await bookingsRepository.createCancellationRequestEvent(
          client,
          request.id,
          request.booking_id,
          input.action,
          "Customer contacted about the cancellation request.",
          "admin",
          adminUserId
        );
        return {
          cancellation_request_id: request.id,
          booking_id: request.booking_id,
          booking_status: request.booking_status,
          cancellation_status: request.status,
          action: input.action
        };
      }

      if (input.action === "cancellation_approved") {
        if (
          request.status === "approved" &&
          request.booking_status === "cancelled"
        ) {
          return {
            cancellation_request_id: request.id,
            booking_id: request.booking_id,
            booking_status: request.booking_status,
            cancellation_status: request.status,
            action: input.action
          };
        }
        if (
          request.status !== "pending_admin_review" ||
          request.booking_status !== "cancellation_requested"
        ) {
          throw new ConflictError(
            "Only pending cancellation requests can be approved"
          );
        }

        await bookingsRepository.createCancellationRequestEvent(
          client,
          request.id,
          request.booking_id,
          input.action,
          "Cancellation approved by administrator.",
          "admin",
          adminUserId
        );
        await bookingsRepository.completeCancellationReview(
          client,
          request.id,
          "approved",
          adminUserId
        );
        await bookingsRepository.markCancellationRequestedBookingCancelled(
          client,
          request.booking_id
        );
        await bookingsRepository.releaseBookingSlots(
          client,
          request.booking_id
        );

        return {
          cancellation_request_id: request.id,
          booking_id: request.booking_id,
          booking_status: "cancelled",
          cancellation_status: "approved",
          action: input.action
        };
      }

      if (
        request.status === "rejected" &&
        request.booking_status === "confirmed"
      ) {
        return {
          cancellation_request_id: request.id,
          booking_id: request.booking_id,
          booking_status: request.booking_status,
          cancellation_status: request.status,
          action: input.action
        };
      }
      if (
        request.status !== "pending_admin_review" ||
        request.booking_status !== "cancellation_requested"
      ) {
        throw new ConflictError(
          "Only pending cancellation requests can be rejected"
        );
      }

      await bookingsRepository.createCancellationRequestEvent(
        client,
        request.id,
        request.booking_id,
        input.action,
        "Cancellation rejected by administrator.",
        "admin",
        adminUserId
      );
      await bookingsRepository.completeCancellationReview(
        client,
        request.id,
        "rejected",
        adminUserId
      );
      await bookingsRepository.restoreCancellationRequestedBooking(
        client,
        request.booking_id
      );

      return {
        cancellation_request_id: request.id,
        booking_id: request.booking_id,
        booking_status: "confirmed",
        cancellation_status: "rejected",
        action: input.action
      };
    });
  }
};
