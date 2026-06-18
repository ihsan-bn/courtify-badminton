import type { PoolClient } from "pg";

import {
  query,
  queryWithClient
} from "../../config/database.js";
import type { AdminBookingsQuery } from "./bookings.schemas.js";

export interface ActiveCourtRecord {
  id: string;
}

export interface LockedBookingRecord {
  id: string;
  status: "locked";
  court_id: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  total_amount_bnd: string;
  lock_expires_at: Date;
}

export type BookingStatus =
  | "locked"
  | "confirmed"
  | "cancellation_requested"
  | "cancelled"
  | "expired";

export type BookingSlotStatus =
  | "locked"
  | "confirmed"
  | "cancellation_requested"
  | "cancelled";

export type CancellationRequestStatus =
  | "pending_admin_review"
  | "admin_verifying"
  | "customer_contacted"
  | "approved"
  | "refund_in_progress"
  | "refund_completed"
  | "closed"
  | "rejected";

export interface BookingHistoryRow {
  booking_id: string;
  booking_status: BookingStatus;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
  court_id: string;
  court_name: string;
  court_location: string;
  total_amount_bnd: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  lock_expires_at: Date | null;
  created_at: Date;
  slot_date: string | null;
  start_hour: number | null;
  slot_status: BookingSlotStatus | null;
}

export interface CancellableBookingRecord {
  id: string;
  user_id: string;
  status: BookingStatus;
  reservation_start_at: Date;
  total_amount_bnd: string;
  stripe_payment_intent_id: string | null;
}

export interface RefundRecord {
  id: string;
  booking_id: string;
  stripe_refund_id: string | null;
  amount_bnd: string;
  status:
    | "pending"
    | "requires_action"
    | "succeeded"
    | "failed"
    | "cancelled";
  created_at: Date;
}

export interface CancellationRequestRecord {
  id: string;
  booking_id: string;
  user_id: string;
  reason: string | null;
  status: CancellationRequestStatus;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  refund_notes: string | null;
  refunded_at: Date | null;
  refunded_by: string | null;
}

export interface CustomerCancellationTimelineRow {
  booking_id: string;
  cancellation_request_id: string;
  cancellation_status: CancellationRequestStatus;
  cancellation_reason: string | null;
  cancellation_created_at: Date;
  cancellation_reviewed_at: Date | null;
  cancellation_reviewed_by: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  refunded_at: Date | null;
  event_id: string | null;
  event_type: string | null;
  event_message: string | null;
  event_actor_type: "customer" | "admin" | "system" | null;
  event_created_at: Date | null;
}

export interface AdminCancellationRequestRecord {
  cancellation_request_id: string;
  booking_id: string;
  user_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone_number: string;
  court_id: string;
  court_name: string;
  court_location: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  total_amount_bnd: string;
  reason: string | null;
  status: CancellationRequestStatus;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  refund_notes: string | null;
  refunded_at: Date | null;
  refunded_by: string | null;
}

export interface AdminCancellationRequestDetailRecord
  extends AdminCancellationRequestRecord {
  booking_status: BookingStatus;
}

export interface AdminCancellationSlotRecord {
  slot_date: string;
  start_hour: number;
  status: BookingSlotStatus;
}

export interface CancellationEventRecord {
  event_id: string;
  event_type: string;
  message: string;
  actor_type: "customer" | "admin" | "system";
  actor_user_id: string | null;
  created_at: Date;
}

export interface AdminCancellationRequestForUpdate {
  id: string;
  booking_id: string;
  status: CancellationRequestStatus;
  booking_status: BookingStatus;
}

interface ExpiredBookingRecord {
  id: string;
}

export const bookingsRepository = {
  async findActiveCourt(
    client: PoolClient,
    courtId: string
  ): Promise<ActiveCourtRecord | null> {
    const result = await queryWithClient<ActiveCourtRecord>(
      client,
      `
        select id
        from public.courts
        where id = $1
          and active = true
        for share
      `,
      [courtId]
    );

    return result.rows[0] ?? null;
  },

  async findExpiredLockIds(client: PoolClient): Promise<string[]> {
    const result = await queryWithClient<ExpiredBookingRecord>(
      client,
      `
        select id
        from public.bookings
        where status = 'locked'
          and lock_expires_at < now()
        for update skip locked
      `
    );

    return result.rows.map((booking) => booking.id);
  },

  async deleteSlotsForExpiredBookings(
    client: PoolClient,
    bookingIds: string[]
  ): Promise<void> {
    if (bookingIds.length === 0) {
      return;
    }

    await queryWithClient(
      client,
      `
        delete from public.booking_slots
        where booking_id = any($1::uuid[])
      `,
      [bookingIds]
    );
  },

  async markBookingsExpired(
    client: PoolClient,
    bookingIds: string[]
  ): Promise<number> {
    if (bookingIds.length === 0) {
      return 0;
    }

    const result = await queryWithClient<ExpiredBookingRecord>(
      client,
      `
        update public.bookings
        set status = 'expired',
            lock_expires_at = null
        where id = any($1::uuid[])
          and status = 'locked'
          and lock_expires_at < now()
        returning id
      `,
      [bookingIds]
    );

    return result.rowCount ?? 0;
  },

  async findExpiredOverlappingLockIds(
    client: PoolClient,
    courtId: string,
    slotDate: string,
    startHours: number[]
  ): Promise<string[]> {
    const result = await queryWithClient<ExpiredBookingRecord>(
      client,
      `
        select booking.id
        from public.bookings as booking
        where booking.status = 'locked'
          and booking.lock_expires_at < now()
          and exists (
            select 1
            from public.booking_slots as booking_slot
            where booking_slot.booking_id = booking.id
              and booking_slot.court_id = $1
              and booking_slot.slot_date = $2::date
              and booking_slot.start_hour = any($3::integer[])
              and booking_slot.status = 'locked'
          )
        for update
      `,
      [courtId, slotDate, startHours]
    );

    return result.rows.map((booking) => booking.id);
  },

  async createLockedBooking(
    client: PoolClient,
    userId: string,
    courtId: string,
    totalAmountBnd: string,
    reservationStartAt: Date,
    reservationEndAt: Date
  ): Promise<LockedBookingRecord> {
    const result = await queryWithClient<LockedBookingRecord>(
      client,
      `
        insert into public.bookings (
          user_id,
          court_id,
          status,
          total_amount_bnd,
          lock_expires_at,
          reservation_start_at,
          reservation_end_at
        )
        values (
          $1,
          $2,
          'locked',
          $3::numeric(10, 2),
          now() + interval '10 minutes',
          $4,
          $5
        )
        returning
          id,
          status,
          court_id,
          reservation_start_at,
          reservation_end_at,
          total_amount_bnd,
          lock_expires_at
      `,
      [
        userId,
        courtId,
        totalAmountBnd,
        reservationStartAt,
        reservationEndAt
      ]
    );

    const booking = result.rows[0];
    if (!booking) {
      throw new Error("Booking insert did not return a row");
    }

    return booking;
  },

  async createLockedSlots(
    client: PoolClient,
    bookingId: string,
    courtId: string,
    slotDate: string,
    startHours: number[]
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        insert into public.booking_slots (
          booking_id,
          court_id,
          slot_date,
          start_hour,
          status
        )
        select
          $1,
          $2,
          $3::date,
          requested_hour,
          'locked'
        from unnest($4::integer[]) as requested_hour
      `,
      [bookingId, courtId, slotDate, startHours]
    );
  },

  async findCustomerBookings(userId: string): Promise<BookingHistoryRow[]> {
    const result = await query<BookingHistoryRow>(
      `
        select
          booking.id as booking_id,
          booking.status as booking_status,
          booking.user_id,
          customer.name as customer_name,
          customer.email as customer_email,
          customer.phone_number as customer_phone_number,
          booking.court_id,
          court.name as court_name,
          court.location as court_location,
          booking.total_amount_bnd,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.lock_expires_at,
          booking.created_at,
          booking_slot.slot_date::text as slot_date,
          booking_slot.start_hour,
          booking_slot.status as slot_status
        from public.bookings as booking
        inner join public.users as customer
          on customer.id = booking.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        left join public.booking_slots as booking_slot
          on booking_slot.booking_id = booking.id
        where booking.user_id = $1
        order by booking.created_at desc, booking_slot.start_hour asc
      `,
      [userId]
    );

    return result.rows;
  },

  async findAdminBookings(
    filters: AdminBookingsQuery
  ): Promise<BookingHistoryRow[]> {
    const result = await query<BookingHistoryRow>(
      `
        with filtered_bookings as (
          select booking.id
          from public.bookings as booking
          where ($1::public.booking_status is null or booking.status = $1)
            and ($2::uuid is null or booking.court_id = $2)
            and (
              $3::date is null
              or exists (
                select 1
                from public.booking_slots as filtered_slot
                where filtered_slot.booking_id = booking.id
                  and filtered_slot.slot_date = $3
              )
            )
        )
        select
          booking.id as booking_id,
          booking.status as booking_status,
          booking.user_id,
          customer.name as customer_name,
          customer.email as customer_email,
          customer.phone_number as customer_phone_number,
          booking.court_id,
          court.name as court_name,
          court.location as court_location,
          booking.total_amount_bnd,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.lock_expires_at,
          booking.created_at,
          booking_slot.slot_date::text as slot_date,
          booking_slot.start_hour,
          booking_slot.status as slot_status
        from filtered_bookings
        inner join public.bookings as booking
          on booking.id = filtered_bookings.id
        inner join public.users as customer
          on customer.id = booking.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        left join public.booking_slots as booking_slot
          on booking_slot.booking_id = booking.id
        order by booking.created_at desc, booking_slot.start_hour asc
      `,
      [
        filters.status ?? null,
        filters.court_id ?? null,
        filters.date ?? null
      ]
    );

    return result.rows;
  },

  async findBookingForCancellation(
    client: PoolClient,
    bookingId: string
  ): Promise<CancellableBookingRecord | null> {
    const result = await queryWithClient<CancellableBookingRecord>(
      client,
      `
        select
          id,
          user_id,
          status,
          reservation_start_at,
          total_amount_bnd,
          stripe_payment_intent_id
        from public.bookings
        where id = $1
        for update
      `,
      [bookingId]
    );

    return result.rows[0] ?? null;
  },

  async findRefundByBooking(
    client: PoolClient,
    bookingId: string
  ): Promise<RefundRecord | null> {
    const result = await queryWithClient<RefundRecord>(
      client,
      `
        select
          id,
          booking_id,
          stripe_refund_id,
          amount_bnd,
          status,
          created_at
        from public.refund_records
        where booking_id = $1
      `,
      [bookingId]
    );

    return result.rows[0] ?? null;
  },

  async findCancellationRequestByBooking(
    client: PoolClient,
    bookingId: string
  ): Promise<CancellationRequestRecord | null> {
    const result = await queryWithClient<CancellationRequestRecord>(
      client,
      `
        select
          id,
          booking_id,
          user_id,
          reason,
          status,
          created_at,
          reviewed_at,
          reviewed_by,
          refund_method,
          refund_reference,
          refund_notes,
          refunded_at,
          refunded_by
        from public.cancellation_requests
        where booking_id = $1
        order by created_at desc
        limit 1
      `,
      [bookingId]
    );

    return result.rows[0] ?? null;
  },

  async createCancellationRequest(
    client: PoolClient,
    bookingId: string,
    customerUserId: string,
    reason: string | null
  ): Promise<CancellationRequestRecord> {
    const result = await queryWithClient<CancellationRequestRecord>(
      client,
      `
        insert into public.cancellation_requests (
          booking_id,
          user_id,
          reason,
          status
        )
        values ($1, $2, $3, 'pending_admin_review')
        returning
          id,
          booking_id,
          user_id,
          reason,
          status,
          created_at,
          reviewed_at,
          reviewed_by,
          refund_method,
          refund_reference,
          refund_notes,
          refunded_at,
          refunded_by
      `,
      [bookingId, customerUserId, reason]
    );

    const cancellationRequest = result.rows[0];
    if (!cancellationRequest) {
      throw new Error("Cancellation request insert did not return a row");
    }

    return cancellationRequest;
  },

  async createCancellationRequestEvent(
    client: PoolClient,
    cancellationRequestId: string,
    bookingId: string,
    eventType: string,
    message: string,
    actorType: "customer" | "admin" | "system",
    actorUserId: string | null
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        insert into public.cancellation_request_events (
          cancellation_request_id,
          booking_id,
          event_type,
          message,
          actor_type,
          actor_user_id
        )
        select $1, $2, $3, $4, $5, $6
        where not exists (
          select 1
          from public.cancellation_request_events
          where cancellation_request_id = $1
            and event_type = $3
        )
      `,
      [
        cancellationRequestId,
        bookingId,
        eventType,
        message,
        actorType,
        actorUserId
      ]
    );
  },

  async createPendingRefund(
    client: PoolClient,
    bookingId: string,
    requestedBy: string,
    paymentIntentId: string,
    amountBnd: string
  ): Promise<RefundRecord> {
    const result = await queryWithClient<RefundRecord>(
      client,
      `
        insert into public.refund_records (
          booking_id,
          requested_by,
          stripe_payment_intent_id,
          amount_bnd,
          status
        )
        values ($1, $2, $3, $4::numeric(10, 2), 'pending')
        on conflict (booking_id) do update
          set booking_id = excluded.booking_id
        returning
          id,
          booking_id,
          stripe_refund_id,
          amount_bnd,
          status,
          created_at
      `,
      [bookingId, requestedBy, paymentIntentId, amountBnd]
    );

    const refund = result.rows[0];
    if (!refund) {
      throw new Error("Refund insert did not return a row");
    }
    return refund;
  },

  async updateRefundFromStripe(
    client: PoolClient,
    refundId: string,
    stripeRefundId: string,
    status: RefundRecord["status"],
    failureReason: string | null
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.refund_records
        set stripe_refund_id = $2,
            status = $3,
            failure_reason = $4
        where id = $1
      `,
      [refundId, stripeRefundId, status, failureReason]
    );
  },

  async markBookingCancellationRequested(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.bookings
        set status = 'cancellation_requested',
            lock_expires_at = null
        where id = $1
          and status = 'confirmed'
      `,
      [bookingId]
    );
  },

  async markBookingCancelled(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.bookings
        set status = 'cancelled',
            lock_expires_at = null
        where id = $1
          and status = 'confirmed'
      `,
      [bookingId]
    );
  },

  async markCancellationRequestedBookingCancelled(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.bookings
        set status = 'cancelled',
            lock_expires_at = null
        where id = $1
          and status = 'cancellation_requested'
      `,
      [bookingId]
    );
  },

  async restoreCancellationRequestedBooking(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.bookings
        set status = 'confirmed',
            lock_expires_at = null
        where id = $1
          and status = 'cancellation_requested'
      `,
      [bookingId]
    );
  },

  async releaseBookingSlots(
    client: PoolClient,
    bookingId: string
  ): Promise<void> {
    // Mark first for state consistency, then delete to release the unique keys.
    await queryWithClient(
      client,
      `
        update public.booking_slots
        set status = 'cancelled'
        where booking_id = $1
      `,
      [bookingId]
    );

    await queryWithClient(
      client,
      `
        delete from public.booking_slots
        where booking_id = $1
      `,
      [bookingId]
    );
  },

  async findCustomerCancellationTimeline(
    userId: string
  ): Promise<CustomerCancellationTimelineRow[]> {
    const result = await query<CustomerCancellationTimelineRow>(
      `
        select
          cancellation_request.booking_id,
          cancellation_request.id as cancellation_request_id,
          cancellation_request.status as cancellation_status,
          cancellation_request.reason as cancellation_reason,
          cancellation_request.created_at as cancellation_created_at,
          cancellation_request.reviewed_at as cancellation_reviewed_at,
          cancellation_request.reviewed_by as cancellation_reviewed_by,
          cancellation_request.refund_method,
          cancellation_request.refund_reference,
          cancellation_request.refunded_at,
          cancellation_event.id as event_id,
          cancellation_event.event_type,
          cancellation_event.message as event_message,
          cancellation_event.actor_type as event_actor_type,
          cancellation_event.created_at as event_created_at
        from public.cancellation_requests as cancellation_request
        inner join public.bookings as booking
          on booking.id = cancellation_request.booking_id
        left join public.cancellation_request_events as cancellation_event
          on cancellation_event.cancellation_request_id =
            cancellation_request.id
        where booking.user_id = $1
          and cancellation_request.user_id = $1
        order by
          cancellation_request.created_at asc,
          cancellation_event.created_at asc,
          cancellation_event.id asc
      `,
      [userId]
    );

    return result.rows;
  },

  async findCancellationRequests(): Promise<
    AdminCancellationRequestRecord[]
  > {
    const result = await query<AdminCancellationRequestRecord>(
      `
        select
          cancellation_request.id as cancellation_request_id,
          cancellation_request.booking_id,
          cancellation_request.user_id,
          customer.name as customer_name,
          customer.email as customer_email,
          customer.phone_number as customer_phone_number,
          booking.court_id,
          court.name as court_name,
          court.location as court_location,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.total_amount_bnd,
          cancellation_request.reason,
          cancellation_request.status,
          cancellation_request.created_at,
          cancellation_request.reviewed_at,
          cancellation_request.reviewed_by,
          cancellation_request.refund_method,
          cancellation_request.refund_reference,
          cancellation_request.refund_notes,
          cancellation_request.refunded_at,
          cancellation_request.refunded_by
        from public.cancellation_requests as cancellation_request
        inner join public.bookings as booking
          on booking.id = cancellation_request.booking_id
        inner join public.users as customer
          on customer.id = cancellation_request.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        order by cancellation_request.created_at desc
      `
    );

    return result.rows;
  },

  async findCancellationRequestDetail(
    requestId: string
  ): Promise<AdminCancellationRequestDetailRecord | null> {
    const result = await query<AdminCancellationRequestDetailRecord>(
      `
        select
          cancellation_request.id as cancellation_request_id,
          cancellation_request.booking_id,
          cancellation_request.user_id,
          customer.name as customer_name,
          customer.email as customer_email,
          customer.phone_number as customer_phone_number,
          booking.court_id,
          court.name as court_name,
          court.location as court_location,
          booking.status as booking_status,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.total_amount_bnd,
          cancellation_request.reason,
          cancellation_request.status,
          cancellation_request.created_at,
          cancellation_request.reviewed_at,
          cancellation_request.reviewed_by,
          cancellation_request.refund_method,
          cancellation_request.refund_reference,
          cancellation_request.refund_notes,
          cancellation_request.refunded_at,
          cancellation_request.refunded_by
        from public.cancellation_requests as cancellation_request
        inner join public.bookings as booking
          on booking.id = cancellation_request.booking_id
        inner join public.users as customer
          on customer.id = cancellation_request.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        where cancellation_request.id = $1
      `,
      [requestId]
    );

    return result.rows[0] ?? null;
  },

  async findCancellationRequestSlots(
    bookingId: string
  ): Promise<AdminCancellationSlotRecord[]> {
    const result = await query<AdminCancellationSlotRecord>(
      `
        select
          slot_date::text as slot_date,
          start_hour,
          status
        from public.booking_slots
        where booking_id = $1
        order by slot_date asc, start_hour asc
      `,
      [bookingId]
    );

    return result.rows;
  },

  async findCancellationRequestEvents(
    requestId: string
  ): Promise<CancellationEventRecord[]> {
    const result = await query<CancellationEventRecord>(
      `
        select
          id as event_id,
          event_type,
          message,
          actor_type,
          actor_user_id,
          created_at
        from public.cancellation_request_events
        where cancellation_request_id = $1
        order by created_at asc, id asc
      `,
      [requestId]
    );

    return result.rows;
  },

  async findCancellationRequestForUpdate(
    client: PoolClient,
    requestId: string
  ): Promise<AdminCancellationRequestForUpdate | null> {
    const result = await queryWithClient<AdminCancellationRequestForUpdate>(
      client,
      `
        select
          cancellation_request.id,
          cancellation_request.booking_id,
          cancellation_request.status,
          booking.status as booking_status
        from public.cancellation_requests as cancellation_request
        inner join public.bookings as booking
          on booking.id = cancellation_request.booking_id
        where cancellation_request.id = $1
        for update of cancellation_request, booking
      `,
      [requestId]
    );

    return result.rows[0] ?? null;
  },

  async updateCancellationStatus(
    client: PoolClient,
    requestId: string,
    status: CancellationRequestStatus,
    reviewedBy: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.cancellation_requests
        set status = $2,
            reviewed_at = coalesce(reviewed_at, now()),
            reviewed_by = coalesce(reviewed_by, $3)
        where id = $1
      `,
      [requestId, status, reviewedBy]
    );
  },

  async completeManualRefund(
    client: PoolClient,
    requestId: string,
    refundedBy: string,
    refundMethod: string,
    refundReference: string,
    refundNotes: string
  ): Promise<void> {
    await queryWithClient(
      client,
      `
        update public.cancellation_requests
        set status = 'refund_completed',
            refund_method = $3,
            refund_reference = $4,
            refund_notes = $5,
            refunded_at = now(),
            refunded_by = $2
        where id = $1
          and status = 'refund_in_progress'
      `,
      [
        requestId,
        refundedBy,
        refundMethod,
        refundReference,
        refundNotes
      ]
    );
  }
};
