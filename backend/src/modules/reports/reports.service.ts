import { createCsv, type CsvValue } from "../../utils/csv.js";
import { reportsRepository } from "./reports.repository.js";
import type { ReportDateRange } from "./reports.schemas.js";

export type ReportName =
  | "revenue"
  | "bookings"
  | "cancellations"
  | "refunds"
  | "court-utilization";

export interface CsvReport {
  filename: string;
  content: string;
}

function formatDateTime(value: Date | null): string {
  return value?.toISOString() ?? "";
}

function buildReport(
  name: ReportName,
  range: ReportDateRange,
  headers: string[],
  rows: CsvValue[][]
): CsvReport {
  return {
    filename: `courtify-${name}-${range.from}-to-${range.to}.csv`,
    content: createCsv(headers, rows)
  };
}

export const reportsService = {
  async generateRevenue(range: ReportDateRange): Promise<CsvReport> {
    const rows = await reportsRepository.getRevenue(range);
    return buildReport(
      "revenue",
      range,
      [
        "booking_id",
        "customer_name",
        "court_name",
        "reservation_start_at",
        "reservation_end_at",
        "status",
        "total_amount_bnd",
        "payment_reference",
        "created_at"
      ],
      rows.map((row) => [
        row.booking_id,
        row.customer_name,
        row.court_name,
        formatDateTime(row.reservation_start_at),
        formatDateTime(row.reservation_end_at),
        row.status,
        row.total_amount_bnd,
        row.payment_reference,
        formatDateTime(row.created_at)
      ])
    );
  },

  async generateBookings(range: ReportDateRange): Promise<CsvReport> {
    const rows = await reportsRepository.getBookings(range);
    return buildReport(
      "bookings",
      range,
      [
        "booking_id",
        "customer_name",
        "customer_phone",
        "customer_email",
        "court_name",
        "reservation_start_at",
        "reservation_end_at",
        "duration_hours",
        "status",
        "total_amount_bnd",
        "created_at"
      ],
      rows.map((row) => [
        row.booking_id,
        row.customer_name,
        row.customer_phone,
        row.customer_email,
        row.court_name,
        formatDateTime(row.reservation_start_at),
        formatDateTime(row.reservation_end_at),
        row.duration_hours,
        row.status,
        row.total_amount_bnd,
        formatDateTime(row.created_at)
      ])
    );
  },

  async generateCancellations(range: ReportDateRange): Promise<CsvReport> {
    const rows = await reportsRepository.getCancellations(range);
    return buildReport(
      "cancellations",
      range,
      [
        "cancellation_request_id",
        "booking_id",
        "customer_name",
        "customer_phone",
        "court_name",
        "reservation_start_at",
        "cancellation_status",
        "requested_at",
        "reviewed_at",
        "latest_event"
      ],
      rows.map((row) => [
        row.cancellation_request_id,
        row.booking_id,
        row.customer_name,
        row.customer_phone,
        row.court_name,
        formatDateTime(row.reservation_start_at),
        row.cancellation_status,
        formatDateTime(row.requested_at),
        formatDateTime(row.reviewed_at),
        row.latest_event
      ])
    );
  },

  async generateRefunds(range: ReportDateRange): Promise<CsvReport> {
    const rows = await reportsRepository.getRefunds(range);
    return buildReport(
      "refunds",
      range,
      [
        "cancellation_request_id",
        "booking_id",
        "customer_name",
        "court_name",
        "refund_status",
        "refund_method",
        "refund_reference",
        "refunded_at",
        "refunded_by",
        "total_amount_bnd"
      ],
      rows.map((row) => [
        row.cancellation_request_id,
        row.booking_id,
        row.customer_name,
        row.court_name,
        row.refund_status,
        row.refund_method,
        row.refund_reference,
        formatDateTime(row.refunded_at),
        row.refunded_by,
        row.total_amount_bnd
      ])
    );
  },

  async generateCourtUtilization(
    range: ReportDateRange
  ): Promise<CsvReport> {
    const rows = await reportsRepository.getCourtUtilization(range);
    return buildReport(
      "court-utilization",
      range,
      [
        "court_id",
        "court_name",
        "total_booked_hours",
        "confirmed_hours",
        "cancelled_hours",
        "booking_count",
        "revenue_bnd"
      ],
      rows.map((row) => [
        row.court_id,
        row.court_name,
        row.total_booked_hours,
        row.confirmed_hours,
        row.cancelled_hours,
        row.booking_count,
        row.revenue_bnd
      ])
    );
  }
};
