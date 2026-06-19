"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import { ApiError, downloadApiFile } from "@/lib/api";

type ReportKey =
  | "revenue"
  | "bookings"
  | "cancellations"
  | "refunds"
  | "court-utilization";

interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
}

const REPORTS: ReportDefinition[] = [
  {
    key: "revenue",
    title: "Revenue Report",
    description:
      "Paid booking revenue with customer, court, payment reference, status, and reservation details."
  },
  {
    key: "bookings",
    title: "Booking Report",
    description:
      "Reservation schedule, customer contact details, duration, booking status, and BND totals."
  },
  {
    key: "cancellations",
    title: "Cancellation Report",
    description:
      "Cancellation requests, review status, reservation time, and the latest recorded timeline event."
  },
  {
    key: "refunds",
    title: "Refund Report",
    description:
      "Manual refunds in progress or completed, including method, reference, administrator, and BND amount."
  },
  {
    key: "court-utilization",
    title: "Court Utilization Report",
    description:
      "Booked, confirmed, and cancelled hours with booking count and gross paid revenue by court."
  }
];

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function getCurrentMonthRange(): { from: string; to: string } {
  const bruneiNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = bruneiNow.getUTCFullYear();
  const month = bruneiNow.getUTCMonth();
  return {
    from: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)
  };
}

function validateRange(from: string, to: string): string | null {
  if (!from || !to) {
    return "Select both a from date and a to date.";
  }

  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  if (fromTime > toTime) {
    return "The to date must be on or after the from date.";
  }

  const inclusiveDays = (toTime - fromTime) / DAY_MILLISECONDS + 1;
  if (inclusiveDays > 366) {
    return "The report date range cannot exceed 366 days.";
  }

  return null;
}

function ReportCard({ report }: { report: ReportDefinition }) {
  const defaults = getCurrentMonthRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadReport() {
    if (downloading) {
      return;
    }

    const validationError = validateRange(from, to);
    if (validationError) {
      setError(validationError);
      return;
    }

    setDownloading(true);
    setError(null);
    const query = new URLSearchParams({ from, to }).toString();
    try {
      await downloadApiFile(
        `/api/admin/reports/${report.key}.csv?${query}`,
        `courtify-${report.key}-${from}-to-${to}.csv`,
        "text/csv"
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to download this report."
      );
    } finally {
      setDownloading(false);
    }
  }

  const fieldPrefix = `report-${report.key}`;

  return (
    <article className="card report-card">
      <div>
        <span className="eyebrow">CSV Export</span>
        <h2>{report.title}</h2>
        <p>{report.description}</p>
      </div>
      <div className="report-date-grid">
        <div className="field">
          <label htmlFor={`${fieldPrefix}-from`}>From date</label>
          <input
            id={`${fieldPrefix}-from`}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            disabled={downloading}
          />
        </div>
        <div className="field">
          <label htmlFor={`${fieldPrefix}-to`}>To date</label>
          <input
            id={`${fieldPrefix}-to`}
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            disabled={downloading}
          />
        </div>
      </div>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions">
        <button
          className="button"
          type="button"
          disabled={downloading}
          onClick={() => void downloadReport()}
        >
          {downloading ? "Preparing CSV..." : "Download CSV"}
        </button>
      </div>
    </article>
  );
}

export default function AdminReportsPage() {
  return (
    <AdminGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Administrator Reports</span>
          <h1 className="page-title">Business-ready exports.</h1>
          <p className="lede">
            Download Courtify-Badminton revenue, booking, cancellation, refund,
            and court performance data as secure CSV files.
          </p>
          <div className="actions">
            <Link className="button-secondary" href="/admin/dashboard">
              Back to Dashboard
            </Link>
            <Link className="button-secondary" href="/admin/analytics">
              View Analytics
            </Link>
          </div>
        </div>

        <div className="reports-grid">
          {REPORTS.map((report) => (
            <ReportCard key={report.key} report={report} />
          ))}
        </div>
      </section>
    </AdminGuard>
  );
}
