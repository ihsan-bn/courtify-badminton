import { query } from "../../config/database.js";

export interface DashboardSummaryRecord {
  total_bookings: string;
  bookings_today: string;
  bookings_this_month: string;
  revenue_today: string;
  revenue_this_month: string;
  upcoming_bookings_count: string;
  pending_cancellation_requests: string;
  refunds_in_progress: string;
  active_courts: string;
}

export type OperationsBookingStatus = "confirmed" | "cancellation_requested";

export interface CourtOccupancyRecord {
  court_id: string;
  court_name: string;
  current_status: "available" | "occupied" | "upcoming_today";
  current_booking_id: string | null;
  current_customer_name: string | null;
  current_reservation_start_at: Date | null;
  current_reservation_end_at: Date | null;
  next_booking_id: string | null;
  next_customer_name: string | null;
  next_reservation_start_at: Date | null;
  next_reservation_end_at: Date | null;
}

export interface OperationsBookingRecord {
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  reservation_start_at: Date;
  reservation_end_at: Date;
  status: OperationsBookingStatus;
  total_amount_bnd: string;
}

export interface PendingCancellationRecord {
  request_id: string;
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  reservation_start_at: Date;
  cancellation_status:
    | "pending_admin_review"
    | "admin_verifying"
    | "customer_contacted";
  requested_at: Date;
}

export interface RefundInProgressRecord {
  request_id: string;
  booking_id: string;
  customer_name: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  requested_at: Date;
}

export interface RevenueSeriesRecord {
  date: string;
  revenue_bnd: string;
}

export interface BookingSeriesRecord {
  date: string;
  booking_count: string;
}

export interface DayOfWeekAnalyticsRecord {
  day: string;
  booking_count: string;
  revenue_bnd: string;
}

export interface PopularCourtRecord {
  court_id: string;
  court_name: string;
  booking_count: string;
  revenue_bnd: string;
  total_hours: string;
}

export interface PeakBookingHourRecord {
  start_hour: number;
  booking_count: string;
}

export interface TopCustomerRecord {
  user_id: string;
  customer_name: string | null;
  booking_count: string;
  revenue_bnd: string;
}

export interface CancellationSummaryRecord {
  pending_admin_review: string;
  admin_verifying: string;
  customer_contacted: string;
  approved: string;
  refund_in_progress: string;
  refund_completed: string;
  closed: string;
  rejected: string;
}

export interface RefundSummaryRecord {
  refund_in_progress_count: string;
  refund_completed_count: string;
  closed_count: string;
}

export const dashboardRepository = {
  async getSummary(): Promise<DashboardSummaryRecord> {
    const result = await query<DashboardSummaryRecord>(
      `
        with brunei_clock as (
          select
            now() at time zone 'Asia/Brunei' as local_now,
            (now() at time zone 'Asia/Brunei')::date as local_today,
            date_trunc(
              'month',
              now() at time zone 'Asia/Brunei'
            ) as local_month_start
        ),
        booking_metrics as (
          select
            count(*) as total_bookings,
            count(*) filter (
              where (booking.created_at at time zone 'Asia/Brunei')::date =
                clock.local_today
            ) as bookings_today,
            count(*) filter (
              where booking.created_at at time zone 'Asia/Brunei' >=
                clock.local_month_start
            ) as bookings_this_month,
            coalesce(
              sum(booking.total_amount_bnd) filter (
                where booking.status in ('confirmed', 'cancellation_requested')
                  and (
                    booking.created_at at time zone 'Asia/Brunei'
                  )::date = clock.local_today
              ),
              0
            ) as revenue_today,
            coalesce(
              sum(booking.total_amount_bnd) filter (
                where booking.status in ('confirmed', 'cancellation_requested')
                  and booking.created_at at time zone 'Asia/Brunei' >=
                    clock.local_month_start
              ),
              0
            ) as revenue_this_month,
            count(*) filter (
              where booking.status in ('confirmed', 'cancellation_requested')
                and booking.reservation_start_at > now()
            ) as upcoming_bookings_count
          from public.bookings as booking
          cross join brunei_clock as clock
        ),
        cancellation_metrics as (
          select
            count(*) filter (
              where status in (
                'pending_admin_review',
                'admin_verifying',
                'customer_contacted'
              )
            ) as pending_cancellation_requests,
            count(*) filter (
              where status = 'refund_in_progress'
            ) as refunds_in_progress
          from public.cancellation_requests
        ),
        court_metrics as (
          select count(*) filter (where active = true) as active_courts
          from public.courts
        )
        select
          booking_metrics.total_bookings::text,
          booking_metrics.bookings_today::text,
          booking_metrics.bookings_this_month::text,
          booking_metrics.revenue_today::numeric(10, 2)::text,
          booking_metrics.revenue_this_month::numeric(10, 2)::text,
          booking_metrics.upcoming_bookings_count::text,
          cancellation_metrics.pending_cancellation_requests::text,
          cancellation_metrics.refunds_in_progress::text,
          court_metrics.active_courts::text
        from booking_metrics
        cross join cancellation_metrics
        cross join court_metrics
      `
    );

    const summary = result.rows[0];
    if (!summary) {
      throw new Error("Dashboard summary query did not return a row");
    }

    return summary;
  },

  async getTodayDate(): Promise<string> {
    const result = await query<{ today_date: string }>(
      `
        select (
          now() at time zone 'Asia/Brunei'
        )::date::text as today_date
      `
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Operations date query did not return a row");
    }
    return row.today_date;
  },

  async getLiveCourtOccupancy(): Promise<CourtOccupancyRecord[]> {
    const result = await query<CourtOccupancyRecord>(
      `
        select
          court.id as court_id,
          court.name as court_name,
          case
            when current_booking.booking_id is not null then 'occupied'
            when next_booking.booking_id is not null then 'upcoming_today'
            else 'available'
          end as current_status,
          current_booking.booking_id as current_booking_id,
          current_booking.customer_name as current_customer_name,
          current_booking.reservation_start_at
            as current_reservation_start_at,
          current_booking.reservation_end_at as current_reservation_end_at,
          next_booking.booking_id as next_booking_id,
          next_booking.customer_name as next_customer_name,
          next_booking.reservation_start_at as next_reservation_start_at,
          next_booking.reservation_end_at as next_reservation_end_at
        from public.courts as court
        left join lateral (
          select
            booking.id as booking_id,
            customer.name as customer_name,
            booking.reservation_start_at,
            booking.reservation_end_at
          from public.bookings as booking
          inner join public.users as customer
            on customer.id = booking.user_id
          where booking.court_id = court.id
            and booking.status in ('confirmed', 'cancellation_requested')
            and booking.reservation_start_at <= now()
            and booking.reservation_end_at > now()
          order by booking.reservation_start_at asc
          limit 1
        ) as current_booking on true
        left join lateral (
          select
            booking.id as booking_id,
            customer.name as customer_name,
            booking.reservation_start_at,
            booking.reservation_end_at
          from public.bookings as booking
          inner join public.users as customer
            on customer.id = booking.user_id
          where booking.court_id = court.id
            and booking.status in ('confirmed', 'cancellation_requested')
            and booking.reservation_start_at > now()
            and (
              booking.reservation_start_at at time zone 'Asia/Brunei'
            )::date = (now() at time zone 'Asia/Brunei')::date
          order by booking.reservation_start_at asc
          limit 1
        ) as next_booking on current_booking.booking_id is null
        where court.active = true
        order by court.name asc
      `
    );

    return result.rows;
  },

  async getTodaysBookings(): Promise<OperationsBookingRecord[]> {
    const result = await query<OperationsBookingRecord>(
      `
        select
          booking.id as booking_id,
          customer.name as customer_name,
          court.name as court_name,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.status,
          booking.total_amount_bnd
        from public.bookings as booking
        inner join public.users as customer
          on customer.id = booking.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        where booking.status in ('confirmed', 'cancellation_requested')
          and (
            booking.reservation_start_at at time zone 'Asia/Brunei'
          )::date = (now() at time zone 'Asia/Brunei')::date
        order by booking.reservation_start_at asc
      `
    );

    return result.rows;
  },

  async getUpcomingBookings(): Promise<OperationsBookingRecord[]> {
    const result = await query<OperationsBookingRecord>(
      `
        select
          booking.id as booking_id,
          customer.name as customer_name,
          court.name as court_name,
          booking.reservation_start_at,
          booking.reservation_end_at,
          booking.status,
          booking.total_amount_bnd
        from public.bookings as booking
        inner join public.users as customer
          on customer.id = booking.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        where booking.status in ('confirmed', 'cancellation_requested')
          and booking.reservation_start_at > now()
        order by booking.reservation_start_at asc
        limit 10
      `
    );

    return result.rows;
  },

  async getPendingCancellations(): Promise<PendingCancellationRecord[]> {
    const result = await query<PendingCancellationRecord>(
      `
        select
          cancellation_request.id as request_id,
          cancellation_request.booking_id,
          customer.name as customer_name,
          court.name as court_name,
          booking.reservation_start_at,
          cancellation_request.status as cancellation_status,
          cancellation_request.created_at as requested_at
        from public.cancellation_requests as cancellation_request
        inner join public.bookings as booking
          on booking.id = cancellation_request.booking_id
        inner join public.users as customer
          on customer.id = cancellation_request.user_id
        inner join public.courts as court
          on court.id = booking.court_id
        where cancellation_request.status in (
          'pending_admin_review',
          'admin_verifying',
          'customer_contacted'
        )
        order by cancellation_request.created_at asc
      `
    );

    return result.rows;
  },

  async getRefundsInProgress(): Promise<RefundInProgressRecord[]> {
    const result = await query<RefundInProgressRecord>(
      `
        select
          cancellation_request.id as request_id,
          cancellation_request.booking_id,
          customer.name as customer_name,
          cancellation_request.refund_method,
          cancellation_request.refund_reference,
          cancellation_request.created_at as requested_at
        from public.cancellation_requests as cancellation_request
        inner join public.users as customer
          on customer.id = cancellation_request.user_id
        where cancellation_request.status = 'refund_in_progress'
        order by cancellation_request.created_at asc
      `
    );

    return result.rows;
  },

  async getRevenueLast30Days(): Promise<RevenueSeriesRecord[]> {
    const result = await query<RevenueSeriesRecord>(
      `
        with date_series as (
          select generate_series(
            (now() at time zone 'Asia/Brunei')::date - 29,
            (now() at time zone 'Asia/Brunei')::date,
            interval '1 day'
          )::date as metric_date
        ),
        daily_revenue as (
          select
            (booking.created_at at time zone 'Asia/Brunei')::date
              as metric_date,
            sum(booking.total_amount_bnd) as revenue_bnd
          from public.bookings as booking
          where booking.status in (
              'confirmed',
              'cancellation_requested',
              'cancelled'
            )
            and booking.stripe_payment_intent_id is not null
            and (booking.created_at at time zone 'Asia/Brunei')::date >=
              (now() at time zone 'Asia/Brunei')::date - 29
          group by metric_date
        )
        select
          date_series.metric_date::text as date,
          coalesce(daily_revenue.revenue_bnd, 0)::numeric(12, 2)::text
            as revenue_bnd
        from date_series
        left join daily_revenue
          on daily_revenue.metric_date = date_series.metric_date
        order by date_series.metric_date asc
      `
    );

    return result.rows;
  },

  async getBookingsLast30Days(): Promise<BookingSeriesRecord[]> {
    const result = await query<BookingSeriesRecord>(
      `
        with date_series as (
          select generate_series(
            (now() at time zone 'Asia/Brunei')::date - 29,
            (now() at time zone 'Asia/Brunei')::date,
            interval '1 day'
          )::date as metric_date
        ),
        daily_bookings as (
          select
            (booking.created_at at time zone 'Asia/Brunei')::date
              as metric_date,
            count(*) as booking_count
          from public.bookings as booking
          where booking.status in (
              'confirmed',
              'cancellation_requested',
              'cancelled'
            )
            and (booking.created_at at time zone 'Asia/Brunei')::date >=
              (now() at time zone 'Asia/Brunei')::date - 29
          group by metric_date
        )
        select
          date_series.metric_date::text as date,
          coalesce(daily_bookings.booking_count, 0)::text as booking_count
        from date_series
        left join daily_bookings
          on daily_bookings.metric_date = date_series.metric_date
        order by date_series.metric_date asc
      `
    );

    return result.rows;
  },

  async getDayOfWeekAnalytics(): Promise<DayOfWeekAnalyticsRecord[]> {
    const result = await query<DayOfWeekAnalyticsRecord>(
      `
        with weekdays as (
          select *
          from (
            values
              (1, 'Monday'),
              (2, 'Tuesday'),
              (3, 'Wednesday'),
              (4, 'Thursday'),
              (5, 'Friday'),
              (6, 'Saturday'),
              (7, 'Sunday')
          ) as weekday(day_number, day_name)
        ),
        booking_metrics as (
          select
            extract(
              isodow from booking.reservation_start_at
                at time zone 'Asia/Brunei'
            )::integer as day_number,
            count(*) as booking_count,
            coalesce(
              sum(booking.total_amount_bnd) filter (
                where booking.stripe_payment_intent_id is not null
              ),
              0
            ) as revenue_bnd
          from public.bookings as booking
          where booking.status in (
            'confirmed',
            'cancellation_requested',
            'cancelled'
          )
          group by day_number
        )
        select
          weekdays.day_name as day,
          coalesce(booking_metrics.booking_count, 0)::text as booking_count,
          coalesce(booking_metrics.revenue_bnd, 0)::numeric(12, 2)::text
            as revenue_bnd
        from weekdays
        left join booking_metrics
          on booking_metrics.day_number = weekdays.day_number
        order by weekdays.day_number asc
      `
    );

    return result.rows;
  },

  async getPopularCourts(): Promise<PopularCourtRecord[]> {
    const result = await query<PopularCourtRecord>(
      `
        select
          court.id as court_id,
          court.name as court_name,
          count(booking.id)::text as booking_count,
          coalesce(
            sum(booking.total_amount_bnd) filter (
              where booking.stripe_payment_intent_id is not null
            ),
            0
          )::numeric(12, 2)::text as revenue_bnd,
          coalesce(
            sum(
              extract(
                epoch from (
                  booking.reservation_end_at - booking.reservation_start_at
                )
              ) / 3600
            ),
            0
          )::numeric(12, 2)::text as total_hours
        from public.courts as court
        inner join public.bookings as booking
          on booking.court_id = court.id
          and booking.status in (
            'confirmed',
            'cancellation_requested',
            'cancelled'
          )
        group by court.id, court.name
        order by count(booking.id) desc, court.name asc
      `
    );

    return result.rows;
  },

  async getPeakBookingHours(): Promise<PeakBookingHourRecord[]> {
    const result = await query<PeakBookingHourRecord>(
      `
        with operating_hours as (
          select generate_series(8, 21) as start_hour
        ),
        occupied_hours as (
          select
            extract(
              hour from occupied_hour at time zone 'Asia/Brunei'
            )::integer as start_hour,
            count(*) as booking_count
          from public.bookings as booking
          cross join lateral generate_series(
            booking.reservation_start_at,
            booking.reservation_end_at - interval '1 hour',
            interval '1 hour'
          ) as occupied_hour
          where booking.status in (
            'confirmed',
            'cancellation_requested',
            'cancelled'
          )
          group by start_hour
        )
        select
          operating_hours.start_hour,
          coalesce(occupied_hours.booking_count, 0)::text as booking_count
        from operating_hours
        left join occupied_hours
          on occupied_hours.start_hour = operating_hours.start_hour
        order by
          coalesce(occupied_hours.booking_count, 0) desc,
          operating_hours.start_hour asc
      `
    );

    return result.rows;
  },

  async getTopCustomers(): Promise<TopCustomerRecord[]> {
    const result = await query<TopCustomerRecord>(
      `
        select
          customer.id as user_id,
          customer.name as customer_name,
          count(booking.id)::text as booking_count,
          coalesce(
            sum(booking.total_amount_bnd) filter (
              where booking.stripe_payment_intent_id is not null
            ),
            0
          )::numeric(12, 2)::text as revenue_bnd
        from public.users as customer
        inner join public.bookings as booking
          on booking.user_id = customer.id
          and booking.status in (
            'confirmed',
            'cancellation_requested',
            'cancelled'
          )
        where customer.role = 'customer'
        group by customer.id, customer.name
        order by count(booking.id) desc, 4 desc
        limit 10
      `
    );

    return result.rows;
  },

  async getCancellationSummary(): Promise<CancellationSummaryRecord> {
    const result = await query<CancellationSummaryRecord>(
      `
        select
          count(*) filter (
            where status = 'pending_admin_review'
          )::text as pending_admin_review,
          count(*) filter (
            where status = 'admin_verifying'
          )::text as admin_verifying,
          count(*) filter (
            where status = 'customer_contacted'
          )::text as customer_contacted,
          count(*) filter (where status = 'approved')::text as approved,
          count(*) filter (
            where status = 'refund_in_progress'
          )::text as refund_in_progress,
          count(*) filter (
            where status = 'refund_completed'
          )::text as refund_completed,
          count(*) filter (where status = 'closed')::text as closed,
          count(*) filter (where status = 'rejected')::text as rejected
        from public.cancellation_requests
      `
    );

    const summary = result.rows[0];
    if (!summary) {
      throw new Error("Cancellation analytics query did not return a row");
    }
    return summary;
  },

  async getRefundSummary(): Promise<RefundSummaryRecord> {
    const result = await query<RefundSummaryRecord>(
      `
        select
          count(*) filter (
            where status = 'refund_in_progress'
          )::text as refund_in_progress_count,
          count(*) filter (
            where status = 'refund_completed'
          )::text as refund_completed_count,
          count(*) filter (
            where status = 'closed'
          )::text as closed_count
        from public.cancellation_requests
      `
    );

    const summary = result.rows[0];
    if (!summary) {
      throw new Error("Refund analytics query did not return a row");
    }
    return summary;
  }
};
