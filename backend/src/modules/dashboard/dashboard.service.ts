import { dashboardRepository } from "./dashboard.repository.js";
import type {
  CourtOccupancyRecord,
  DayOfWeekAnalyticsRecord,
  OperationsBookingRecord
} from "./dashboard.repository.js";

export interface DashboardSummary {
  total_bookings: number;
  bookings_today: number;
  bookings_this_month: number;
  revenue_today: string;
  revenue_this_month: string;
  upcoming_bookings_count: number;
  pending_cancellation_requests: number;
  refunds_in_progress: number;
  active_courts: number;
}

interface OperationsBooking {
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  reservation_start_at: string;
  reservation_end_at: string;
  status: "confirmed" | "cancellation_requested";
  total_amount_bnd: string;
}

interface OccupancyBooking {
  booking_id: string;
  customer_name: string | null;
  reservation_start_at: string;
  reservation_end_at: string;
}

interface CourtOccupancy {
  court_id: string;
  court_name: string;
  current_status: "available" | "occupied" | "upcoming_today";
  current_booking: OccupancyBooking | null;
  next_booking_today: OccupancyBooking | null;
}

interface PendingCancellation {
  request_id: string;
  booking_id: string;
  customer_name: string | null;
  court_name: string;
  reservation_start_at: string;
  cancellation_status:
    | "pending_admin_review"
    | "admin_verifying"
    | "customer_contacted";
  requested_at: string;
}

interface RefundInProgress {
  request_id: string;
  booking_id: string;
  customer_name: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  requested_at: string;
}

export interface DashboardOperations {
  today_date: string;
  live_court_occupancy: CourtOccupancy[];
  todays_bookings: OperationsBooking[];
  upcoming_bookings: OperationsBooking[];
  pending_cancellations: PendingCancellation[];
  refunds_in_progress: RefundInProgress[];
}

interface RevenueSeriesPoint {
  date: string;
  revenue_bnd: string;
}

interface BookingSeriesPoint {
  date: string;
  booking_count: number;
}

interface DayOfWeekAnalytics {
  day: string;
  booking_count: number;
  revenue_bnd: string;
}

interface PopularCourt {
  court_id: string;
  court_name: string;
  booking_count: number;
  revenue_bnd: string;
  total_hours: number;
}

interface PeakBookingHour {
  start_hour: number;
  label: string;
  booking_count: number;
}

interface TopCustomer {
  user_id: string;
  customer_name: string | null;
  booking_count: number;
  revenue_bnd: string;
}

interface CancellationSummary {
  pending_admin_review: number;
  admin_verifying: number;
  customer_contacted: number;
  approved: number;
  refund_in_progress: number;
  refund_completed: number;
  closed: number;
  rejected: number;
}

interface RefundSummary {
  refund_in_progress_count: number;
  refund_completed_count: number;
  closed_count: number;
}

export interface DashboardAnalytics {
  revenue_last_30_days: RevenueSeriesPoint[];
  bookings_last_30_days: BookingSeriesPoint[];
  bookings_by_day_of_week: DayOfWeekAnalytics[];
  revenue_by_day_of_week: DayOfWeekAnalytics[];
  popular_courts: PopularCourt[];
  peak_booking_hours: PeakBookingHour[];
  top_customers: TopCustomer[];
  cancellation_summary: CancellationSummary;
  refund_summary: RefundSummary;
}

function parseCount(value: string, field: string): number {
  const count = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Dashboard ${field} is invalid`);
  }
  return count;
}

function formatOperationsBooking(
  booking: OperationsBookingRecord
): OperationsBooking {
  return {
    booking_id: booking.booking_id,
    customer_name: booking.customer_name,
    court_name: booking.court_name,
    reservation_start_at: booking.reservation_start_at.toISOString(),
    reservation_end_at: booking.reservation_end_at.toISOString(),
    status: booking.status,
    total_amount_bnd: booking.total_amount_bnd
  };
}

function formatOccupancyBooking(
  bookingId: string | null,
  customerName: string | null,
  reservationStartAt: Date | null,
  reservationEndAt: Date | null
): OccupancyBooking | null {
  if (!bookingId || !reservationStartAt || !reservationEndAt) {
    return null;
  }

  return {
    booking_id: bookingId,
    customer_name: customerName,
    reservation_start_at: reservationStartAt.toISOString(),
    reservation_end_at: reservationEndAt.toISOString()
  };
}

function formatCourtOccupancy(court: CourtOccupancyRecord): CourtOccupancy {
  return {
    court_id: court.court_id,
    court_name: court.court_name,
    current_status: court.current_status,
    current_booking: formatOccupancyBooking(
      court.current_booking_id,
      court.current_customer_name,
      court.current_reservation_start_at,
      court.current_reservation_end_at
    ),
    next_booking_today: formatOccupancyBooking(
      court.next_booking_id,
      court.next_customer_name,
      court.next_reservation_start_at,
      court.next_reservation_end_at
    )
  };
}

function formatDayOfWeek(
  row: DayOfWeekAnalyticsRecord
): DayOfWeekAnalytics {
  return {
    day: row.day,
    booking_count: parseCount(row.booking_count, `${row.day} bookings`),
    revenue_bnd: row.revenue_bnd
  };
}

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const summary = await dashboardRepository.getSummary();

    return {
      total_bookings: parseCount(summary.total_bookings, "total bookings"),
      bookings_today: parseCount(summary.bookings_today, "bookings today"),
      bookings_this_month: parseCount(
        summary.bookings_this_month,
        "bookings this month"
      ),
      revenue_today: summary.revenue_today,
      revenue_this_month: summary.revenue_this_month,
      upcoming_bookings_count: parseCount(
        summary.upcoming_bookings_count,
        "upcoming bookings"
      ),
      pending_cancellation_requests: parseCount(
        summary.pending_cancellation_requests,
        "pending cancellation requests"
      ),
      refunds_in_progress: parseCount(
        summary.refunds_in_progress,
        "refunds in progress"
      ),
      active_courts: parseCount(summary.active_courts, "active courts")
    };
  },

  async getOperations(): Promise<DashboardOperations> {
    const [
      todayDate,
      occupancy,
      todaysBookings,
      upcomingBookings,
      pendingCancellations,
      refundsInProgress
    ] = await Promise.all([
      dashboardRepository.getTodayDate(),
      dashboardRepository.getLiveCourtOccupancy(),
      dashboardRepository.getTodaysBookings(),
      dashboardRepository.getUpcomingBookings(),
      dashboardRepository.getPendingCancellations(),
      dashboardRepository.getRefundsInProgress()
    ]);

    return {
      today_date: todayDate,
      live_court_occupancy: occupancy.map(formatCourtOccupancy),
      todays_bookings: todaysBookings.map(formatOperationsBooking),
      upcoming_bookings: upcomingBookings.map(formatOperationsBooking),
      pending_cancellations: pendingCancellations.map((request) => ({
        request_id: request.request_id,
        booking_id: request.booking_id,
        customer_name: request.customer_name,
        court_name: request.court_name,
        reservation_start_at: request.reservation_start_at.toISOString(),
        cancellation_status: request.cancellation_status,
        requested_at: request.requested_at.toISOString()
      })),
      refunds_in_progress: refundsInProgress.map((refund) => ({
        request_id: refund.request_id,
        booking_id: refund.booking_id,
        customer_name: refund.customer_name,
        refund_method: refund.refund_method,
        refund_reference: refund.refund_reference,
        requested_at: refund.requested_at.toISOString()
      }))
    };
  },

  async getAnalytics(): Promise<DashboardAnalytics> {
    const [
      revenueSeries,
      bookingSeries,
      dayOfWeek,
      popularCourts,
      peakHours,
      topCustomers,
      cancellationSummary,
      refundSummary
    ] = await Promise.all([
      dashboardRepository.getRevenueLast30Days(),
      dashboardRepository.getBookingsLast30Days(),
      dashboardRepository.getDayOfWeekAnalytics(),
      dashboardRepository.getPopularCourts(),
      dashboardRepository.getPeakBookingHours(),
      dashboardRepository.getTopCustomers(),
      dashboardRepository.getCancellationSummary(),
      dashboardRepository.getRefundSummary()
    ]);

    const weekdayAnalytics = dayOfWeek.map(formatDayOfWeek);

    return {
      revenue_last_30_days: revenueSeries,
      bookings_last_30_days: bookingSeries.map((point) => ({
        date: point.date,
        booking_count: parseCount(
          point.booking_count,
          `bookings on ${point.date}`
        )
      })),
      bookings_by_day_of_week: weekdayAnalytics,
      revenue_by_day_of_week: weekdayAnalytics,
      popular_courts: popularCourts.map((court) => ({
        court_id: court.court_id,
        court_name: court.court_name,
        booking_count: parseCount(
          court.booking_count,
          `${court.court_name} bookings`
        ),
        revenue_bnd: court.revenue_bnd,
        total_hours: Number.parseFloat(court.total_hours)
      })),
      peak_booking_hours: peakHours.map((hour) => ({
        start_hour: hour.start_hour,
        label: `${hour.start_hour.toString().padStart(2, "0")}:00 - ${(
          hour.start_hour + 1
        )
          .toString()
          .padStart(2, "0")}:00`,
        booking_count: parseCount(
          hour.booking_count,
          `bookings at ${hour.start_hour.toString()}:00`
        )
      })),
      top_customers: topCustomers.map((customer) => ({
        user_id: customer.user_id,
        customer_name: customer.customer_name,
        booking_count: parseCount(
          customer.booking_count,
          "customer bookings"
        ),
        revenue_bnd: customer.revenue_bnd
      })),
      cancellation_summary: {
        pending_admin_review: parseCount(
          cancellationSummary.pending_admin_review,
          "pending cancellation requests"
        ),
        admin_verifying: parseCount(
          cancellationSummary.admin_verifying,
          "admin verifying cancellations"
        ),
        customer_contacted: parseCount(
          cancellationSummary.customer_contacted,
          "customer contacted cancellations"
        ),
        approved: parseCount(
          cancellationSummary.approved,
          "approved cancellations"
        ),
        refund_in_progress: parseCount(
          cancellationSummary.refund_in_progress,
          "refunds in progress"
        ),
        refund_completed: parseCount(
          cancellationSummary.refund_completed,
          "completed refunds"
        ),
        closed: parseCount(
          cancellationSummary.closed,
          "closed cancellation cases"
        ),
        rejected: parseCount(
          cancellationSummary.rejected,
          "rejected cancellations"
        )
      },
      refund_summary: {
        refund_in_progress_count: parseCount(
          refundSummary.refund_in_progress_count,
          "refunds in progress"
        ),
        refund_completed_count: parseCount(
          refundSummary.refund_completed_count,
          "completed refunds"
        ),
        closed_count: parseCount(
          refundSummary.closed_count,
          "closed refund cases"
        )
      }
    };
  }
};
