"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import {
  apiFetch,
  ApiError,
  type AdminDashboardOperations,
  type AdminDashboardSummary,
  type DashboardOperationsBooking,
  type UserProfile
} from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";

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

interface KpiCardProps {
  label: string;
  value: string | number;
  description: string;
  tone?: "default" | "positive" | "warning";
}

function KpiCard({
  label,
  value,
  description,
  tone = "default"
}: KpiCardProps) {
  return (
    <article className={`card kpi-card kpi-${tone}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <p>{description}</p>
    </article>
  );
}

function OperationsBookingList({
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
    <div className="operations-list">
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
            <small className="reference-value">{booking.booking_id}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [operations, setOperations] =
    useState<AdminDashboardOperations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const profileResult = await apiFetch<{ user: UserProfile }>("/api/me", {
          auth: true
        });
        if (!mounted) {
          return;
        }

        setUser(profileResult.user);
        if (profileResult.user.role === "admin") {
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
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load the dashboard."
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
  }, [router]);

  function handleLogout() {
    clearAccessToken();
    router.replace("/login");
  }

  const isAdmin = user?.role === "admin";

  return (
    <AuthGuard>
      <section className="page">
        <div>
          <span className="eyebrow">
            {isAdmin ? "Executive dashboard" : "Customer dashboard"}
          </span>
          <h1 className="page-title">
            {user?.name ? `Welcome, ${user.name}.` : "Welcome to Courtify."}
          </h1>
          <p className="lede">
            {isAdmin
              ? "A concise operational view of Courtify-Badminton bookings, revenue, cancellations, refunds, and active courts."
              : "Book badminton courts, review your reservations, and manage eligible cancellation requests."}
          </p>
        </div>

        {loading ? <p className="loading">Loading dashboard...</p> : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {user ? (
          <section className="card" aria-label="Account profile">
            <div className="booking-card-header">
              <div>
                <h2>Profile</h2>
                <p>{isAdmin ? "Administrator account" : "Customer account"}</p>
              </div>
              <span className="status-pill">{user.role}</span>
            </div>
            <div className="profile-list">
              <div className="profile-row">
                <span>Name</span>
                <strong>{user.name ?? "Not completed"}</strong>
              </div>
              <div className="profile-row">
                <span>Email</span>
                <strong>{user.email ?? "Not completed"}</strong>
              </div>
              <div className="profile-row">
                <span>Phone</span>
                <strong>{user.phone_number}</strong>
              </div>
            </div>
            <div className="actions">
              <button
                className="button-ghost"
                type="button"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </section>
        ) : null}

        {isAdmin && summary ? (
          <div className="kpi-dashboard">
            <section className="kpi-section" aria-labelledby="booking-kpis">
              <div className="kpi-section-heading">
                <h2 id="booking-kpis">Bookings</h2>
                <p>Booking records created in Brunei local time.</p>
              </div>
              <div className="kpi-grid">
                <KpiCard
                  label="Total Bookings"
                  value={summary.total_bookings}
                  description="All booking records."
                />
                <KpiCard
                  label="Today's Bookings"
                  value={summary.bookings_today}
                  description="Bookings created today."
                  tone="positive"
                />
                <KpiCard
                  label="This Month's Bookings"
                  value={summary.bookings_this_month}
                  description="Bookings created this month."
                />
              </div>
            </section>

            <section className="kpi-section" aria-labelledby="revenue-kpis">
              <div className="kpi-section-heading">
                <h2 id="revenue-kpis">Revenue</h2>
                <p>Active paid booking value, excluding cancelled bookings.</p>
              </div>
              <div className="kpi-grid">
                <KpiCard
                  label="Revenue Today"
                  value={formatBnd(summary.revenue_today)}
                  description="Confirmed value created today."
                  tone="positive"
                />
                <KpiCard
                  label="Revenue This Month"
                  value={formatBnd(summary.revenue_this_month)}
                  description="Confirmed value created this month."
                  tone="positive"
                />
              </div>
            </section>

            <section className="kpi-section" aria-labelledby="operations-kpis">
              <div className="kpi-section-heading">
                <h2 id="operations-kpis">Operations</h2>
                <p>Live workload requiring operational attention.</p>
              </div>
              <div className="kpi-grid">
                <KpiCard
                  label="Upcoming Bookings"
                  value={summary.upcoming_bookings_count}
                  description="Future confirmed or cancellation-requested bookings."
                />
                <KpiCard
                  label="Pending Cancellations"
                  value={summary.pending_cancellation_requests}
                  description="Requests still in admin review."
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
                  tone={
                    summary.refunds_in_progress > 0 ? "warning" : "default"
                  }
                />
              </div>
            </section>

            <section className="kpi-section" aria-labelledby="court-kpis">
              <div className="kpi-section-heading">
                <h2 id="court-kpis">Courts</h2>
                <p>Current Courtify-Badminton operating capacity.</p>
              </div>
              <div className="kpi-grid">
                <KpiCard
                  label="Active Courts"
                  value={summary.active_courts}
                  description="Courts available for customer booking."
                  tone="positive"
                />
              </div>
            </section>
          </div>
        ) : null}

        {isAdmin && operations ? (
          <div className="operations-dashboard">
            <div className="kpi-section-heading">
              <span className="eyebrow">Live Operations</span>
              <h2>Today, {operations.today_date}</h2>
              <p>
                Court occupancy and active operational workload in Brunei time.
              </p>
            </div>

            <section
              className="operations-section"
              aria-labelledby="court-occupancy"
            >
              <div className="kpi-section-heading">
                <h2 id="court-occupancy">Live Court Occupancy</h2>
                <p>Current use and the next reservation later today.</p>
              </div>
              {operations.live_court_occupancy.length === 0 ? (
                <p className="empty-state">No active courts are configured.</p>
              ) : (
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
                                {formatTime(
                                  activeBooking.reservation_start_at
                                )}
                                -
                                {formatTime(activeBooking.reservation_end_at)}
                              </strong>
                            </div>
                            <div className="summary-row">
                              <span>Customer</span>
                              <strong>
                                {activeBooking.customer_name ?? "Customer"}
                              </strong>
                            </div>
                            <div className="summary-row">
                              <span>Booking ID</span>
                              <strong className="reference-value">
                                {activeBooking.booking_id}
                              </strong>
                            </div>
                          </div>
                        ) : (
                          <p>No more active reservations today.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="operations-columns">
              <section className="card operations-panel">
                <div className="booking-card-header">
                  <div>
                    <h2>Today&apos;s Bookings</h2>
                    <p>Active paid reservations scheduled today.</p>
                  </div>
                  <span className="status-pill">
                    {operations.todays_bookings.length}
                  </span>
                </div>
                <OperationsBookingList
                  bookings={operations.todays_bookings}
                  emptyMessage="No active bookings are scheduled today."
                />
              </section>

              <section className="card operations-panel">
                <div className="booking-card-header">
                  <div>
                    <h2>Upcoming Bookings</h2>
                    <p>The next 10 active reservations after now.</p>
                  </div>
                  <span className="status-pill">
                    {operations.upcoming_bookings.length}
                  </span>
                </div>
                <OperationsBookingList
                  bookings={operations.upcoming_bookings}
                  emptyMessage="No upcoming bookings are scheduled."
                />
              </section>
            </div>

            <div className="operations-columns">
              <section className="card operations-panel">
                <div className="booking-card-header">
                  <div>
                    <h2>Pending Cancellations</h2>
                    <p>Cases still moving through administrator review.</p>
                  </div>
                  <span className="status-pill status-cancellation_requested">
                    {operations.pending_cancellations.length}
                  </span>
                </div>
                {operations.pending_cancellations.length === 0 ? (
                  <p className="empty-state">
                    No cancellation requests need review.
                  </p>
                ) : (
                  <div className="operations-list">
                    {operations.pending_cancellations.map((request) => (
                      <article
                        className="operations-row"
                        key={request.request_id}
                      >
                        <div>
                          <strong>{request.court_name}</strong>
                          <p>
                            {request.customer_name ?? "Customer"} -{" "}
                            {formatDateTime(request.reservation_start_at)}
                          </p>
                        </div>
                        <div className="operations-row-meta">
                          <span className="status-pill status-cancellation_requested">
                            {formatStatus(request.cancellation_status)}
                          </span>
                          <Link
                            className="button-secondary"
                            href={`/admin/cancellations/${request.request_id}`}
                          >
                            View case
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="card operations-panel">
                <div className="booking-card-header">
                  <div>
                    <h2>Refunds In Progress</h2>
                    <p>Manual refund cases awaiting completion.</p>
                  </div>
                  <span className="status-pill status-locked">
                    {operations.refunds_in_progress.length}
                  </span>
                </div>
                {operations.refunds_in_progress.length === 0 ? (
                  <p className="empty-state">
                    No manual refunds are currently in progress.
                  </p>
                ) : (
                  <div className="operations-list">
                    {operations.refunds_in_progress.map((refund) => (
                      <article
                        className="operations-row"
                        key={refund.request_id}
                      >
                        <div>
                          <strong>
                            {refund.customer_name ?? "Customer"}
                          </strong>
                          <p>
                            Requested {formatDateTime(refund.requested_at)}
                          </p>
                          <p className="hint">
                            {refund.refund_method ?? "Method not recorded"} -{" "}
                            {refund.refund_reference ??
                              "Reference not recorded"}
                          </p>
                        </div>
                        <div className="operations-row-meta">
                          <span className="status-pill status-locked">
                            Refund in progress
                          </span>
                          <Link
                            className="button-secondary"
                            href={`/admin/cancellations/${refund.request_id}`}
                          >
                            View case
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}

        {isAdmin ? (
          <section className="dashboard-grid" aria-label="Administrator tools">
            <article className="card">
              <h3>Manage Cancellations</h3>
              <p>Review requests and track manual refund cases.</p>
              <div className="actions">
                <Link
                  className="button-secondary"
                  href="/admin/cancellations"
                >
                  Open cancellation queue
                </Link>
              </div>
            </article>
            <article className="card">
              <h3>Revenue Analytics</h3>
              <p>Review revenue, booking demand, courts, and customer trends.</p>
              <div className="actions">
                <Link className="button-secondary" href="/admin/analytics">
                  Open analytics
                </Link>
              </div>
            </article>
            <article className="card placeholder-card">
              <h3>Court Analytics</h3>
              <p>Court utilization analytics will be available in a future phase.</p>
            </article>
          </section>
        ) : (
          <section className="dashboard-grid" aria-label="Customer booking tools">
            <article className="card">
              <h3>Book a Court</h3>
              <p>Select one court and reserve consecutive hourly slots.</p>
              <div className="actions">
                <Link className="button-secondary" href="/book">
                  Start booking
                </Link>
              </div>
            </article>
            <article className="card">
              <h3>My Bookings</h3>
              <p>View your locked, confirmed, cancelled, and expired bookings.</p>
              <div className="actions">
                <Link className="button-secondary" href="/bookings">
                  View bookings
                </Link>
              </div>
            </article>
          </section>
        )}
      </section>
    </AuthGuard>
  );
}
