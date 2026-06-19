"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import {
  apiFetch,
  ApiError,
  type AdminDashboardAnalytics
} from "@/lib/api";

function formatBnd(amount: string): string {
  return new Intl.NumberFormat("en-BN", {
    style: "currency",
    currency: "BND"
  }).format(Number.parseFloat(amount));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function percentage(value: number, maximum: number): string {
  if (maximum <= 0 || value <= 0) {
    return "0%";
  }
  return `${Math.max(3, (value / maximum) * 100)}%`;
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] =
    useState<AdminDashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      try {
        const result = await apiFetch<AdminDashboardAnalytics>(
          "/api/admin/dashboard/analytics",
          { auth: true }
        );
        if (mounted) {
          setAnalytics(result);
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load analytics."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();
    return () => {
      mounted = false;
    };
  }, []);

  const maximumRevenue = useMemo(
    () =>
      Math.max(
        0,
        ...(analytics?.revenue_last_30_days.map((point) =>
          Number.parseFloat(point.revenue_bnd)
        ) ?? [])
      ),
    [analytics]
  );
  const maximumBookings = useMemo(
    () =>
      Math.max(
        0,
        ...(analytics?.bookings_last_30_days.map(
          (point) => point.booking_count
        ) ?? [])
      ),
    [analytics]
  );
  const maximumPeakHour = useMemo(
    () =>
      Math.max(
        0,
        ...(analytics?.peak_booking_hours.map(
          (hour) => hour.booking_count
        ) ?? [])
      ),
    [analytics]
  );

  return (
    <AdminGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Administrator Analytics</span>
          <h1 className="page-title">Booking performance.</h1>
          <p className="lede">
            Revenue, demand, court usage, customers, cancellations, and manual
            refund trends from Courtify-Badminton records.
          </p>
          <div className="actions">
            <Link className="button-secondary" href="/dashboard">
              Back to Dashboard
            </Link>
            <Link className="button-secondary" href="/admin/cancellations">
              Manage Cancellations
            </Link>
          </div>
        </div>

        {loading ? <p className="loading">Loading analytics...</p> : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && analytics ? (
          <div className="analytics-dashboard">
            <div className="analytics-columns">
              <section className="card analytics-panel">
                <div>
                  <span className="eyebrow">Last 30 Days</span>
                  <h2>Revenue</h2>
                  <p>Gross paid booking value by creation date.</p>
                </div>
                <div className="mini-bar-chart" aria-label="Revenue by date">
                  {analytics.revenue_last_30_days.map((point) => {
                    const value = Number.parseFloat(point.revenue_bnd);
                    return (
                      <div className="mini-bar-column" key={point.date}>
                        <div
                          className="mini-bar mini-bar-revenue"
                          style={{ height: percentage(value, maximumRevenue) }}
                          title={`${formatDate(point.date)}: ${formatBnd(point.revenue_bnd)}`}
                        />
                        <span>{formatDate(point.date)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card analytics-panel">
                <div>
                  <span className="eyebrow">Last 30 Days</span>
                  <h2>Bookings</h2>
                  <p>Confirmed, cancellation-requested, and cancelled records.</p>
                </div>
                <div className="mini-bar-chart" aria-label="Bookings by date">
                  {analytics.bookings_last_30_days.map((point) => (
                    <div className="mini-bar-column" key={point.date}>
                      <div
                        className="mini-bar"
                        style={{
                          height: percentage(
                            point.booking_count,
                            maximumBookings
                          )
                        }}
                        title={`${formatDate(point.date)}: ${point.booking_count} bookings`}
                      />
                      <span>{formatDate(point.date)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="card analytics-panel">
              <div>
                <span className="eyebrow">Weekly Pattern</span>
                <h2>Day of Week Breakdown</h2>
              </div>
              <div className="table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Bookings</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.bookings_by_day_of_week.map((day) => (
                      <tr key={day.day}>
                        <td>{day.day}</td>
                        <td>{day.booking_count}</td>
                        <td>{formatBnd(day.revenue_bnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="analytics-columns">
              <section className="card analytics-panel">
                <div>
                  <span className="eyebrow">Court Demand</span>
                  <h2>Popular Courts</h2>
                </div>
                {analytics.popular_courts.length === 0 ? (
                  <p className="empty-state">No booking data is available.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>Court</th>
                          <th>Bookings</th>
                          <th>Hours</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.popular_courts.map((court) => (
                          <tr key={court.court_id}>
                            <td>{court.court_name}</td>
                            <td>{court.booking_count}</td>
                            <td>{court.total_hours}</td>
                            <td>{formatBnd(court.revenue_bnd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="card analytics-panel">
                <div>
                  <span className="eyebrow">Hourly Demand</span>
                  <h2>Peak Booking Hours</h2>
                </div>
                <div className="horizontal-bars">
                  {analytics.peak_booking_hours.map((hour) => (
                    <div className="horizontal-bar-row" key={hour.start_hour}>
                      <span>{hour.label}</span>
                      <div className="horizontal-bar-track">
                        <div
                          className="horizontal-bar-fill"
                          style={{
                            width: percentage(
                              hour.booking_count,
                              maximumPeakHour
                            )
                          }}
                        />
                      </div>
                      <strong>{hour.booking_count}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="card analytics-panel">
              <div>
                <span className="eyebrow">Customer Activity</span>
                <h2>Top Customers</h2>
                <p>Display names and aggregate activity only.</p>
              </div>
              {analytics.top_customers.length === 0 ? (
                <p className="empty-state">No customer booking data exists.</p>
              ) : (
                <div className="table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Bookings</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.top_customers.map((customer) => (
                        <tr key={customer.user_id}>
                          <td>{customer.customer_name ?? "Customer"}</td>
                          <td>{customer.booking_count}</td>
                          <td>{formatBnd(customer.revenue_bnd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="analytics-columns">
              <section className="card analytics-panel">
                <div>
                  <span className="eyebrow">Case Workflow</span>
                  <h2>Cancellation Summary</h2>
                </div>
                <div className="stat-list">
                  {Object.entries(analytics.cancellation_summary).map(
                    ([status, count]) => (
                      <div className="summary-row" key={status}>
                        <span>{formatStatus(status)}</span>
                        <strong>{count}</strong>
                      </div>
                    )
                  )}
                </div>
              </section>

              <section className="card analytics-panel">
                <div>
                  <span className="eyebrow">Manual Refunds</span>
                  <h2>Refund Summary</h2>
                </div>
                <div className="stat-list">
                  {Object.entries(analytics.refund_summary).map(
                    ([status, count]) => (
                      <div className="summary-row" key={status}>
                        <span>
                          {formatStatus(status.replace(/_count$/, ""))}
                        </span>
                        <strong>{count}</strong>
                      </div>
                    )
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </section>
    </AdminGuard>
  );
}
