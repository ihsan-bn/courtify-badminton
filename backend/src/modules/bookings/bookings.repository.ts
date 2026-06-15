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
}

export interface CancellationRequestRecord {
  id: string;
  booking_id: string;
  user_id: string;
  reason: string | null;
  status: "pending_admin_review";
  created_at: Date;
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
  status: "pending_admin_review" | "refund_completed" | "rejected";
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
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
        select id, user_id, status, reservation_start_at
        from public.bookings
        where id = $1
        for update
      `,
      [bookingId]
    );

    return result.rows[0] ?? null;
  },

  async createCancellationRequest(
    client: PoolClient,
    bookingId: string,
    userId: string,
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
        returning id, booking_id, user_id, reason, status, created_at
      `,
      [bookingId, userId, reason]
    );

    const cancellationRequest = result.rows[0];
    if (!cancellationRequest) {
      throw new Error("Cancellation request insert did not return a row");
    }

    return cancellationRequest;
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
        set status = 'cancellation_requested'
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
          cancellation_request.reviewed_by
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
  }
};
