import type { RequestHandler, Response } from "express";

import {
  type CsvReport,
  reportsService
} from "./reports.service.js";
import type { ReportDateRange } from "./reports.schemas.js";
import { auditService } from "../audit/audit.service.js";

function sendCsv(response: Response, report: CsvReport): void {
  response
    .status(200)
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Cache-Control": "private, no-store"
    })
    .send(report.content);
}

function getRange(query: unknown): ReportDateRange {
  return query as ReportDateRange;
}

async function auditReportDownload(
  request: Parameters<RequestHandler>[0],
  reportName: string,
  range: ReportDateRange
): Promise<void> {
  await auditService.record({
    actor: {
      userId: request.authenticatedUser?.id ?? null,
      role: "admin"
    },
    action: "report_downloaded",
    entityType: "report",
    summary: `Administrator downloaded the ${reportName} report.`,
    metadata: { report_name: reportName, from: range.from, to: range.to },
    request
  });
}

export const downloadRevenueReport: RequestHandler = async (
  request,
  response
) => {
  const range = getRange(request.query);
  sendCsv(response, await reportsService.generateRevenue(range));
  await auditReportDownload(request, "revenue", range);
};

export const downloadBookingsReport: RequestHandler = async (
  request,
  response
) => {
  const range = getRange(request.query);
  sendCsv(
    response,
    await reportsService.generateBookings(range)
  );
  await auditReportDownload(request, "bookings", range);
};

export const downloadCancellationsReport: RequestHandler = async (
  request,
  response
) => {
  const range = getRange(request.query);
  sendCsv(
    response,
    await reportsService.generateCancellations(range)
  );
  await auditReportDownload(request, "cancellations", range);
};

export const downloadRefundsReport: RequestHandler = async (
  request,
  response
) => {
  const range = getRange(request.query);
  sendCsv(response, await reportsService.generateRefunds(range));
  await auditReportDownload(request, "refunds", range);
};

export const downloadCourtUtilizationReport: RequestHandler = async (
  request,
  response
) => {
  const range = getRange(request.query);
  sendCsv(
    response,
    await reportsService.generateCourtUtilization(range)
  );
  await auditReportDownload(request, "court-utilization", range);
};
