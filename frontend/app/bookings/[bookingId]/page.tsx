"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import { apiFetch, ApiError, type CustomerBooking } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";

const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

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

function isAtLeast24HoursAway(value: string): boolean {
  return new Date(value).getTime() - Date.now() >= CANCELLATION_WINDOW_MS;
}

function getCancellationPolicyMessage(booking: CustomerBooking): string {
  if (
    booking.status === "confirmed" &&
    isAtLeast24HoursAway(booking.reservation_start_at)
  ) {
    return "Cancellation is available. Bookings cancelled at least 24 hours before the start time are eligible for a full refund.";
  }

  if (booking.status === "confirmed") {
    return "Cancellation is no longer available because this booking starts within 24 hours. No refund is available under the Courtify cancellation policy.";
  }

  if (booking.status === "locked") {
    return "This booking is still a temporary payment lock, so cancellation is not available.";
  }

  if (booking.status === "cancellation_requested") {
    return "A cancellation request has already been submitted for this booking.";
  }

  if (booking.status === "cancelled") {
    return "This booking has already been cancelled.";
  }

  return "This booking lock has expired, so cancellation is not available.";
}

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = getRouteBookingId(params.bookingId);
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submittingCancellation, setSubmittingCancellation] = useState(false);

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const result = await apiFetch<{ bookings: CustomerBooking[] }>(
        "/api/bookings/me",
        { auth: true }
      );
      const matchedBooking =
        result.bookings.find((item) => item.booking_id === bookingId) ?? null;

      setBooking(matchedBooking);
      setNotFound(matchedBooking === null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearAccessToken();
        router.replace("/login");
        return;
      }

      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to load booking details."
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    let mounted = true;

    async function loadIfMounted() {
      if (mounted) {
        await loadBooking();
      }
    }

    loadIfMounted();
    return () => {
      mounted = false;
    };
  }, [loadBooking]);

  const cancellationAllowed = useMemo(() => {
    return (
      booking?.status === "confirmed" &&
      isAtLeast24HoursAway(booking.reservation_start_at)
    );
  }, [booking]);

  async function handleCancelBooking() {
    if (!booking || !cancellationAllowed || submittingCancellation) {
      return;
    }

    setSubmittingCancellation(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      await apiFetch(`/api/bookings/${booking.booking_id}/cancel`, {
        method: "POST",
        auth: true,
        body: {
          reason: "Customer cancellation"
        }
      });
      setConfirmOpen(false);
      setCancelSuccess(
        "Cancellation request submitted. Your booking status has been refreshed."
      );
      await loadBooking();
    } catch (caught) {
      setCancelError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to cancel this booking."
      );
    } finally {
      setSubmittingCancellation(false);
    }
  }

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
        {cancelSuccess ? (
          <p className="success" role="status">
            {cancelSuccess}
          </p>
        ) : null}
        {cancelError ? (
          <p className="alert" role="alert">
            {cancelError}
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

            <section className="policy-panel" aria-labelledby="cancellation">
              <div>
                <h3 id="cancellation">Cancellation policy</h3>
                <p>{getCancellationPolicyMessage(booking)}</p>
              </div>
              {cancellationAllowed ? (
                <button
                  className="button danger-button"
                  type="button"
                  onClick={() => {
                    setCancelError(null);
                    setCancelSuccess(null);
                    setConfirmOpen(true);
                  }}
                  disabled={submittingCancellation}
                >
                  Cancel Booking
                </button>
              ) : null}
            </section>
          </article>
        ) : null}

        {confirmOpen && booking ? (
          <div
            className="dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setConfirmOpen(false);
              }
            }}
          >
            <section
              aria-labelledby="cancel-dialog-title"
              aria-modal="true"
              className="dialog-card"
              role="dialog"
            >
              <h2 id="cancel-dialog-title">
                Are you sure you want to cancel this booking?
              </h2>
              <div className="summary-list">
                <div className="summary-row">
                  <span>Court</span>
                  <strong>{booking.court_name}</strong>
                </div>
                <div className="summary-row">
                  <span>Date</span>
                  <strong>{formatDateTime(booking.reservation_start_at)}</strong>
                </div>
                <div className="summary-row">
                  <span>Start time</span>
                  <strong>{formatDateTime(booking.reservation_start_at)}</strong>
                </div>
                <div className="summary-row">
                  <span>End time</span>
                  <strong>{formatDateTime(booking.reservation_end_at)}</strong>
                </div>
                <div className="summary-row">
                  <span>Total amount</span>
                  <strong>{formatBnd(booking.total_amount_bnd)}</strong>
                </div>
              </div>
              <p className="notice">
                This booking is eligible for cancellation and full refund
                because it starts at least 24 hours from now.
              </p>
              {cancelError ? (
                <p className="alert" role="alert">
                  {cancelError}
                </p>
              ) : null}
              <div className="actions">
                <button
                  className="button danger-button"
                  type="button"
                  onClick={handleCancelBooking}
                  disabled={submittingCancellation}
                >
                  {submittingCancellation
                    ? "Submitting..."
                    : "Yes, cancel booking"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  disabled={submittingCancellation}
                >
                  Keep booking
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </AuthGuard>
  );
}
