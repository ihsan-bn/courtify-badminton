"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  apiFetch,
  ApiError,
  type AdminDashboardOperations,
  type AdminDashboardSummary,
  type DashboardOperationsBooking
} from "@/lib/api";

function formatBnd(amount: string): string {
  return new Intl.NumberFormat("en-BN", {
    style: "currency",
    currency: "BND"
  }).format(Number.parseFloat(amount));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function KpiCard({
  label,
  value,
  description,
  tone = "default"
}: {
  label: string;
  value: string | number;
  description: string;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <article className={`card kpi-card kpi-${tone}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function BookingList({
  bookings,
  emptyMessage
}: {
  bookings: DashboardOperationsBooking[];
  emptyMessage: string;
}) {
  if (bookings.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="operations-list compact-list">
      {bookings.map((booking) => (
        <article className="operations-row" key={booking.booking_id}>
          <div>
            <strong>{booking.court_name}</strong>
            <p>
              {booking.customer_name ?? "Customer"} -{" "}
              {formatDateTime(booking.reservation_start_at)}-
              {formatTime(booking.reservation_end_at)}
            </p>
          </div>
          <div className="operations-row-meta">
            <span className={`status-pill status-${booking.status}`}>
              {formatStatus(booking.status)}
            </span>
            <strong>{formatBnd(booking.total_amount_bnd)}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [operations, setOperations] =
    useState<AdminDashboardOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [dashboardSummary, dashboardOperations] = await Promise.all([
          apiFetch<AdminDashboardSummary>("/api/admin/dashboard/summary", {
            auth: true
          }),
          apiFetch<AdminDashboardOperations>(
            "/api/admin/dashboard/operations",
            { auth: true }
          )
        ]);
        if (mounted) {
          setSummary(dashboardSummary);
          setOperations(dashboardOperations);
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load the admin dashboard."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="page admin-console-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Administrator Dashboard</span>
          <h1 className="page-title">Admin console.</h1>
          <p className="lede">
            Jump between live operations, bookings, cancellations, refunds,
            reports, and audit tools without scrolling through one giant page.
          </p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/admin/analytics">
            Revenue Analytics
          </Link>
          <Link className="button-secondary" href="/admin/reports">
            Business Reports
          </Link>
        </div>
      </div>

      {loading ? <p className="loading">Loading admin console...</p> : null}
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <section id="bookings" className="admin-section">
          <div className="kpi-section-heading">
            <h2>Bookings</h2>
            <p>High-level booking and court capacity indicators.</p>
          </div>
          <div className="kpi-grid">
            <KpiCard
              label="Total Bookings"
              value={summary.total_bookings}
              description="All booking records."
            />
            <KpiCard
              label="Today\u2019s Bookings"
              value={summary.bookings_today}
              description="Bookings created today."
              tone="positive"
            />
            <KpiCard
              label="This Month"
              value={summary.bookings_this_month}
              description="Bookings created this month."
            />
          </div>
        </section>
      ) : null}

      {summary ? (
        <section id="operations" className="admin-section">
          <div className="kpi-section-heading">
            <h2>Operations</h2>
            <p>Workload that may need administrator attention.</p>
          </div>
          <div className="kpi-grid">
            <KpiCard
              label="Upcoming Bookings"
              value={summary.upcoming_bookings_count}
              description="Future active paid reservations."
            />
            <KpiCard
              label="Pending Cancellations"
              value={summary.pending_cancellation_requests}
              description="Cases still in review."
              tone={
                summary.pending_cancellation_requests > 0
                  ? "warning"
                  : "default"
              }
            />
            <KpiCard
              label="Refunds In Progress"
              value={summary.refunds_in_progress}
              description="Manual refunds awaiting completion."
              tone={summary.refunds_in_progress > 0 ? "warning" : "default"}
            />
          </div>
        </section>
      ) : null}

      {operations ? (
        <section id="live-occupancy" className="admin-section">
          <div className="kpi-section-heading">
            <h2>Live Occupancy</h2>
            <p>Current court status for today, {operations.today_date}.</p>
          </div>
          <div className="occupancy-grid">
            {operations.live_court_occupancy.map((court) => {
              const activeBooking =
                court.current_booking ?? court.next_booking_today;
              return (
                <article
                  className={`card occupancy-card occupancy-${court.current_status}`}
                  key={court.court_id}
                >
                  <div className="booking-card-header">
                    <h3>{court.court_name}</h3>
                    <span
                      className={`status-pill occupancy-badge-${court.current_status}`}
                    >
                      {formatStatus(court.current_status)}
                    </span>
                  </div>
                  {activeBooking ? (
                    <div className="summary-list">
                      <div className="summary-row">
                        <span>
                          {court.current_booking
                            ? "Current booking"
                            : "Next booking"}
                        </span>
                        <strong>
                          {formatTime(activeBooking.reservation_start_at)}-
                          {formatTime(activeBooking.reservation_end_at)}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Customer</span>
                        <strong>{activeBooking.customer_name ?? "Customer"}</strong>
                      </div>
                    </div>
                  ) : (
                    <p>No more active reservations today.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {operations ? (
        <div className="operations-columns">
          <section id="todays-bookings" className="card operations-panel">
            <div className="booking-card-header">
              <div>
                <h2>Today\u2019s Bookings</h2>
                <p>Active paid reservations scheduled today.</p>
              </div>
              <span className="status-pill">
                {operations.todays_bookings.length}
              </span>
            </div>
            <BookingList
              bookings={operations.todays_bookings}
              emptyMessage="No active bookings are scheduled today."
            />
          </section>

          <section id="upcoming-bookings" className="card operations-panel">
            <div className="booking-card-header">
              <div>
                <h2>Upcoming Bookings</h2>
                <p>The next 10 active reservations after now.</p>
              </div>
              <span className="status-pill">
                {operations.upcoming_bookings.length}
              </span>
            </div>
            <BookingList
              bookings={operations.upcoming_bookings}
              emptyMessage="No upcoming bookings are scheduled."
            />
          </section>
        </div>
      ) : null}

      {operations ? (
        <div className="operations-columns">
          <section id="refunds" className="card operations-panel">
            <div className="booking-card-header">
              <div>
                <h2>Refunds</h2>
                <p>Manual refund cases awaiting completion.</p>
              </div>
              <span className="status-pill status-locked">
                {operations.refunds_in_progress.length}
              </span>
            </div>
            {operations.refunds_in_progress.length === 0 ? (
              <p className="empty-state">No manual refunds are in progress.</p>
            ) : (
              <div className="operations-list compact-list">
                {operations.refunds_in_progress.map((refund) => (
                  <article className="operations-row" key={refund.request_id}>
                    <div>
                      <strong>{refund.customer_name ?? "Customer"}</strong>
                      <p>Requested {formatDateTime(refund.requested_at)}</p>
                    </div>
                    <Link
                      className="button-secondary"
                      href={`/admin/cancellations/${refund.request_id}`}
                    >
                      View case
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="courts" className="card operations-panel">
            <div className="booking-card-header">
              <div>
                <h2>Courts</h2>
                <p>Configured active court capacity.</p>
              </div>
              <span className="status-pill status-confirmed">
                {summary?.active_courts ?? 0}
              </span>
            </div>
            <p>
              Court administration remains linked from dashboard operations
              until a dedicated court-management page is introduced.
            </p>
          </section>
        </div>
      ) : null}

      <section className="dashboard-grid" aria-label="Administrator tools">
        <article className="card">
          <h3>Cancellations</h3>
          <p>Review requests and track manual refund cases.</p>
          <div className="actions">
            <Link className="button-secondary" href="/admin/cancellations">
              Open cancellation queue
            </Link>
          </div>
        </article>
        <article className="card">
          <h3>Revenue Analytics</h3>
          <p>Review revenue, demand, courts, and customer trends.</p>
          <div className="actions">
            <Link className="button-secondary" href="/admin/analytics">
              Open analytics
            </Link>
          </div>
        </article>
        <article className="card">
          <h3>Audit Logs</h3>
          <p>Review customer, admin, and system accountability events.</p>
          <div className="actions">
            <Link className="button-secondary" href="/admin/audit-logs">
              Open audit logs
            </Link>
          </div>
        </article>
      </section>
    </section>
  );
}
