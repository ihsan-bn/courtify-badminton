"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError, type CustomerBooking } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatBnd(amount: string): string {
  return new Intl.NumberFormat("en-BN", {
    style: "currency",
    currency: "BND"
  }).format(Number.parseFloat(amount));
}

function formatStatus(status: CustomerBooking["status"]): string {
  return status.replaceAll("_", " ");
}

function calculateDurationHours(booking: CustomerBooking): number {
  const start = new Date(booking.reservation_start_at).getTime();
  const end = new Date(booking.reservation_end_at).getTime();
  return Math.max(1, Math.round((end - start) / (60 * 60 * 1000)));
}

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadBookings() {
      try {
        const result = await apiFetch<{ bookings: CustomerBooking[] }>(
          "/api/bookings/me",
          { auth: true }
        );
        if (mounted) {
          setBookings(result.bookings);
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
              : "Unable to load bookings."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadBookings();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <AuthGuard>
      <section className="page">
        <div>
          <span className="eyebrow">My Bookings</span>
          <h1 className="page-title">Your court reservations.</h1>
          <p className="lede">
            Review your Courtify-Badminton booking status, court details, slot
            times, and lock expiry when a payment lock is still active.
          </p>
          <div className="actions">
            <Link className="button" href="/book">
              Book another court
            </Link>
            <Link className="button-secondary" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>

        {loading ? <p className="loading">Loading bookings...</p> : null}
        {error ? <p className="alert" role="alert">{error}</p> : null}

        {!loading && !error && bookings.length === 0 ? (
          <section className="empty-state">
            <h2>No bookings yet</h2>
            <p>
              Your court reservations will appear here after you create a
              booking lock or complete a payment.
            </p>
            <div className="actions">
              <Link className="button" href="/book">
                Book a court
              </Link>
            </div>
          </section>
        ) : null}

        <section className="booking-list" aria-label="Customer bookings">
          {bookings.map((booking) => (
            <article
              className="card booking-card"
              key={booking.booking_id}
              aria-labelledby={`booking-${booking.booking_id}`}
            >
              <div className="booking-card-header">
                <div>
                  <h2 id={`booking-${booking.booking_id}`}>
                    {booking.court_name}
                  </h2>
                  <p>{booking.court_location}</p>
                </div>
                <span className="status-pill">
                  {formatStatus(booking.status)}
                </span>
              </div>

              <div className="grid two">
                <div className="summary-list">
                  <div className="summary-row">
                    <span>Starts</span>
                    <strong>{formatDateTime(booking.reservation_start_at)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Ends</span>
                    <strong>{formatDateTime(booking.reservation_end_at)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Duration</span>
                    <strong>{calculateDurationHours(booking)} hour(s)</strong>
                  </div>
                </div>

                <div className="summary-list">
                  <div className="summary-row">
                    <span>Total</span>
                    <strong>{formatBnd(booking.total_amount_bnd)}</strong>
                  </div>
                  {booking.lock_expires_at ? (
                    <div className="summary-row">
                      <span>Lock expires</span>
                      <strong>{formatDateTime(booking.lock_expires_at)}</strong>
                    </div>
                  ) : null}
                  <div className="summary-row">
                    <span>Booking ID</span>
                    <strong>{booking.booking_id}</strong>
                  </div>
                </div>
              </div>

              <section aria-label="Booking slots">
                <h3>Slots</h3>
                {booking.slots.length === 0 ? (
                  <p className="hint">
                    No active slot rows are attached to this booking.
                  </p>
                ) : (
                  <ul className="slot-list">
                    {booking.slots.map((slot) => (
                      <li key={`${slot.slot_date}-${slot.start_hour}`}>
                        <span>
                          {slot.slot_date} · {formatHour(slot.start_hour)}-
                          {formatHour(slot.end_hour)}
                        </span>
                        <strong>
                          {formatBnd(slot.price_bnd)} ·{" "}
                          {formatStatus(slot.status)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </article>
          ))}
        </section>
      </section>
    </AuthGuard>
  );
}
