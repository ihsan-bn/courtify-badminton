"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

function getRouteBookingId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = getRouteBookingId(params.bookingId);
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadBooking() {
      if (!bookingId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const result = await apiFetch<{ bookings: CustomerBooking[] }>(
          "/api/bookings/me",
          { auth: true }
        );
        const matchedBooking =
          result.bookings.find((item) => item.booking_id === bookingId) ?? null;

        if (mounted) {
          setBooking(matchedBooking);
          setNotFound(matchedBooking === null);
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
              : "Unable to load booking details."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadBooking();
    return () => {
      mounted = false;
    };
  }, [bookingId, router]);

  return (
    <AuthGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Booking Details</span>
          <h1 className="page-title">Reservation reference.</h1>
          <p className="lede">
            View the selected court, slot breakdown, payment reference when
            available, and booking status for this Courtify-Badminton
            reservation.
          </p>
          <div className="actions">
            <Link className="button-secondary" href="/bookings">
              Back to My Bookings
            </Link>
            <Link className="button-secondary" href="/dashboard">
              Back to Dashboard
            </Link>
          </div>
        </div>

        {loading ? <p className="loading">Loading booking details...</p> : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && notFound ? (
          <section className="empty-state">
            <h2>Booking not found</h2>
            <p>
              This booking is not available in your customer booking history.
            </p>
            <div className="actions">
              <Link className="button" href="/bookings">
                Back to My Bookings
              </Link>
              <Link className="button-secondary" href="/dashboard">
                Dashboard
              </Link>
            </div>
          </section>
        ) : null}

        {!loading && !error && booking ? (
          <article
            className="card booking-card"
            aria-labelledby={`booking-detail-${booking.booking_id}`}
          >
            <div className="booking-card-header">
              <div>
                <h2 id={`booking-detail-${booking.booking_id}`}>
                  {booking.court_name}
                </h2>
                <p>{booking.court_location}</p>
              </div>
              <span className={`status-pill status-${booking.status}`}>
                {formatStatus(booking.status)}
              </span>
            </div>

            <div className="grid two">
              <div className="summary-list">
                <div className="summary-row">
                  <span>Booking ID</span>
                  <strong className="reference-value">
                    {booking.booking_id}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Court</span>
                  <strong>{booking.court_name}</strong>
                </div>
                <div className="summary-row">
                  <span>Location</span>
                  <strong>{booking.court_location}</strong>
                </div>
                <div className="summary-row">
                  <span>Created</span>
                  <strong>{formatDateTime(booking.created_at)}</strong>
                </div>
              </div>

              <div className="summary-list">
                <div className="summary-row">
                  <span>Starts</span>
                  <strong>
                    {formatDateTime(booking.reservation_start_at)}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Ends</span>
                  <strong>{formatDateTime(booking.reservation_end_at)}</strong>
                </div>
                <div className="summary-row">
                  <span>Duration</span>
                  <strong>{calculateDurationHours(booking)} hour(s)</strong>
                </div>
                <div className="summary-row">
                  <span>Total</span>
                  <strong>{formatBnd(booking.total_amount_bnd)}</strong>
                </div>
              </div>
            </div>

            {booking.status === "locked" && booking.lock_expires_at ? (
              <div className="summary-list">
                <div className="summary-row">
                  <span>Lock expires</span>
                  <strong>{formatDateTime(booking.lock_expires_at)}</strong>
                </div>
              </div>
            ) : null}

            {booking.stripe_checkout_session_id ? (
              <div className="summary-list">
                <div className="summary-row">
                  <span>Stripe checkout session</span>
                  <strong className="reference-value">
                    {booking.stripe_checkout_session_id}
                  </strong>
                </div>
              </div>
            ) : null}

            <section aria-label="Booking slots">
              <h3>Slots</h3>
              {booking.slots.length === 0 ? (
                <p className="hint">
                  No active slot rows are attached to this booking.
                </p>
              ) : (
                <ul className="slot-list">
                  {booking.slots.map((slot) => (
                    <li
                      key={`${booking.booking_id}-${slot.slot_date}-${slot.start_hour}`}
                    >
                      <span>
                        {slot.slot_date} - {formatHour(slot.start_hour)}-
                        {formatHour(slot.end_hour)}
                      </span>
                      <strong>
                        {formatBnd(slot.price_bnd)} -{" "}
                        {formatStatus(slot.status)}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>
        ) : null}
      </section>
    </AuthGuard>
  );
}
