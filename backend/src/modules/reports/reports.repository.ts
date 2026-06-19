import { query } from "../../config/database.js";
import type { ReportDateRange } from "./reports.schemas.js";

export interface RevenueReportRecord {
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  status: string;
  total_amount_bnd: string;
  payment_reference: string;
  created_at: Date;
}

export interface BookingReportRecord {
  booking_id: string;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  court_name: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  duration_hours: string;
  status: string;
  total_amount_bnd: string;
  created_at: Date;
}

export interface CancellationReportRecord {
  cancellation_request_id: string;
  booking_id: string;
  customer_name: string | null;
  customer_phone: string;
  court_name: string;
  reservation_start_at: Date;
  cancellation_status: string;
  requested_at: Date;
  reviewed_at: Date | null;
  latest_event: string | null;
}

export interface RefundReportRecord {
  cancellation_request_id: string;
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  refund_status: string;
  refund_method: string | null;
  refund_reference: string | null;
  refunded_at: Date | null;
  refunded_by: string | null;
  total_amount_bnd: string;
}

export interface CourtUtilizationReportRecord {
  court_id: string;
  court_name: string;
  total_booked_hours: string;
  confirmed_hours: string;
  cancelled_hours: string;
  booking_count: string;
  revenue_bnd: string;
}

export const reportsRepository = {
  async getRevenue(
    range: ReportDateRange
  ): Promise<RevenueReportRecord[]> {
    const result = await query<RevenueReportRecord>(
      `
        select
          booking.id as booking_id,
          customer.name as customer_name,
          court.name as court_name,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.status,
          booking.total_amount_bnd,
          booking.stripe_payment_intent_id as payment_reference,
          booking.created_at
        from public.bookings as booking
        inner join public.users as customer on customer.id = booking.user_id
        inner join public.courts as court on court.id = booking.court_id
        where booking.status in (
            'confirmed',
            'cancellation_requested',
            'cancelled'
          )
          and booking.stripe_payment_intent_id is not null
          and (booking.created_at at time zone 'Asia/Brunei')::date
            between $1::date and $2::date
        order by booking.created_at asc, booking.id asc
      `,
      [range.from, range.to]
    );
    return result.rows;
  },

  async getBookings(
    range: ReportDateRange
  ): Promise<BookingReportRecord[]> {
    const result = await query<BookingReportRecord>(
      `
        select
          booking.id as booking_id,
          customer.name as customer_name,
          customer.phone_number as customer_phone,
          customer.email as customer_email,
          court.name as court_name,
          booking.reservation_start_at,
          booking.reservation_end_at,
          (
            extract(epoch from (
              booking.reservation_end_at - booking.reservation_start_at
            )) / 3600
          )::numeric(10, 2)::text as duration_hours,
          booking.status,
          booking.total_amount_bnd,
          booking.created_at
        from public.bookings as booking
        inner join public.users as customer on customer.id = booking.user_id
        inner join public.courts as court on court.id = booking.court_id
        where (booking.reservation_start_at at time zone 'Asia/Brunei')::date
          between $1::date and $2::date
        order by booking.reservation_start_at asc, booking.id asc
      `,
      [range.from, range.to]
    );
    return result.rows;
  },

  async getCancellations(
    range: ReportDateRange
  ): Promise<CancellationReportRecord[]> {
    const result = await query<CancellationReportRecord>(
      `
        select
          cancellation_request.id as cancellation_request_id,
          cancellation_request.booking_id,
          customer.name as customer_name,
          customer.phone_number as customer_phone,
          court.name as court_name,
          booking.reservation_start_at,
          cancellation_request.status as cancellation_status,
          cancellation_request.created_at as requested_at,
          cancellation_request.reviewed_at,
          latest_event.event_type as latest_event
        from public.cancellation_requests as cancellation_request
        inner join public.bookings as booking
          on booking.id = cancellation_request.booking_id
        inner join public.users as customer
          on customer.id = cancellation_request.user_id
        inner join public.courts as court on court.id = booking.court_id
        left join lateral (
          select event.event_type
          from public.cancellation_request_events as event
          where event.cancellation_request_id = cancellation_request.id
          order by event.created_at desc, event.id desc
          limit 1
        ) as latest_event on true
        where (
          cancellation_request.created_at at time zone 'Asia/Brunei'
        )::date between $1::date and $2::date
        order by cancellation_request.created_at asc,
          cancellation_request.id asc
      `,
      [range.from, range.to]
    );
    return result.rows;
  },

  async getRefunds(
    range: ReportDateRange
  ): Promise<RefundReportRecord[]> {
    const result = await query<RefundReportRecord>(
      `
        select
          cancellation_request.id as cancellation_request_id,
          cancellation_request.booking_id,
          customer.name as customer_name,
          court.name as court_name,
          cancellation_request.status as refund_status,
          cancellation_request.refund_method,
          cancellation_request.refund_reference,
          cancellation_request.refunded_at,
          refund_admin.name as refunded_by,
          booking.total_amount_bnd
        from public.cancellation_requests as cancellation_request
        inner join public.bookings as booking
          on booking.id = cancellation_request.booking_id
        inner join public.users as customer
          on customer.id = cancellation_request.user_id
        inner join public.courts as court on court.id = booking.court_id
        left join public.users as refund_admin
          on refund_admin.id = cancellation_request.refunded_by
        where cancellation_request.status in (
            'refund_in_progress',
            'refund_completed',
            'closed'
          )
          and (
            cancellation_request.created_at at time zone 'Asia/Brunei'
          )::date between $1::date and $2::date
        order by cancellation_request.created_at asc,
          cancellation_request.id asc
      `,
      [range.from, range.to]
    );
    return result.rows;
  },

  async getCourtUtilization(
    range: ReportDateRange
  ): Promise<CourtUtilizationReportRecord[]> {
    const result = await query<CourtUtilizationReportRecord>(
      `
        select
          court.id as court_id,
          court.name as court_name,
          coalesce(sum(
            extract(epoch from (
              booking.reservation_end_at - booking.reservation_start_at
            )) / 3600
          ) filter (
            where booking.status in (
              'confirmed',
              'cancellation_requested',
              'cancelled'
            )
          ), 0)::numeric(12, 2)::text as total_booked_hours,
          coalesce(sum(
            extract(epoch from (
              booking.reservation_end_at - booking.reservation_start_at
            )) / 3600
          ) filter (
            where booking.status in ('confirmed', 'cancellation_requested')
          ), 0)::numeric(12, 2)::text as confirmed_hours,
          coalesce(sum(
            extract(epoch from (
              booking.reservation_end_at - booking.reservation_start_at
            )) / 3600
          ) filter (
            where booking.status = 'cancelled'
          ), 0)::numeric(12, 2)::text as cancelled_hours,
          count(booking.id) filter (
            where booking.status in (
              'confirmed',
              'cancellation_requested',
              'cancelled'
            )
          )::text as booking_count,
          coalesce(sum(booking.total_amount_bnd) filter (
            where booking.status in (
                'confirmed',
                'cancellation_requested',
                'cancelled'
              )
              and booking.stripe_payment_intent_id is not null
          ), 0)::numeric(12, 2)::text as revenue_bnd
        from public.courts as court
        left join public.bookings as booking
          on booking.court_id = court.id
          and (
            booking.reservation_start_at at time zone 'Asia/Brunei'
          )::date between $1::date and $2::date
        group by court.id, court.name
        order by court.name asc
      `,
      [range.from, range.to]
    );
    return result.rows;
  }
};
