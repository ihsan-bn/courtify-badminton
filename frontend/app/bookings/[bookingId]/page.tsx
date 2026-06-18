"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import { AuthGuard } from "@/components/AuthGuard";
import {
  apiFetch,
  ApiError,
  type BookingStatus,
  type CustomerBooking
} from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";

const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const CANCELLATION_CONFIRMATION_PHRASE = "CANCEL BOOKING";

type CancellationDialogStep = "policy" | "final" | null;

const TIMELINE_LABELS: Record<string, string> = {
  customer_requested_cancellation: "Cancellation requested by customer",
  admin_requested_cancellation: "Cancellation requested by administrator",
  pending_admin_review: "Pending admin review",
  admin_verifying_cancellation: "Admin verifying cancellation",
  admin_confirming_with_customer: "Admin confirming cancellation with customer",
  customer_contacted: "Customer contacted",
  cancellation_approved: "Cancellation approved",
  refund_processing: "Refund processing",
  refund_completed: "Refund completed",
  cancellation_case_closed: "Cancellation and refund case closed",
  cancellation_rejected: "Rejected"
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "full"
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

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatBnd(amount: string): string {
  return new Intl.NumberFormat("en-BN", {
    style: "currency",
    currency: "BND"
  }).format(Number.parseFloat(amount));
}

function formatStatus(status: BookingStatus | string): string {
  return status.replaceAll("_", " ");
}

function formatTimelineLabel(eventType: string): string {
  return TIMELINE_LABELS[eventType] ?? formatStatus(eventType);
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

function isAtLeast24HoursAway(value: string, currentTime: number): boolean {
  return new Date(value).getTime() - currentTime >= CANCELLATION_WINDOW_MS;
}

function getCancellationPolicyMessage(
  booking: CustomerBooking,
  currentTime: number
): string {
  if (booking.cancellation_request?.status === "rejected") {
    return "Your cancellation request was rejected by the administrator.";
  }

  if (
    booking.status === "confirmed" &&
    isAtLeast24HoursAway(booking.reservation_start_at, currentTime)
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
    return "Your cancellation request is pending admin review.";
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
  const [dialogStep, setDialogStep] =
    useState<CancellationDialogStep>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [submittingCancellation, setSubmittingCancellation] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

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
    void loadBooking();
  }, [loadBooking]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const cancellationAllowed = useMemo(() => {
    return (
      booking?.status === "confirmed" &&
      !booking.cancellation_request &&
      isAtLeast24HoursAway(booking.reservation_start_at, currentTime)
    );
  }, [booking, currentTime]);

  const confirmationPhraseMatches =
    confirmationPhrase === CANCELLATION_CONFIRMATION_PHRASE;

  function closeCancellationDialog() {
    if (submittingCancellation) {
      return;
    }

    setDialogStep(null);
    setConfirmationPhrase("");
    setCancelError(null);
  }

  async function handleCancelBooking() {
    if (
      !booking ||
      !cancellationAllowed ||
      !confirmationPhraseMatches ||
      submittingCancellation
    ) {
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
      setDialogStep(null);
      setConfirmationPhrase("");
      setCancelSuccess(
        "Cancellation request submitted. It is now pending admin review."
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

  function handleFinalConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmationPhraseMatches) {
      return;
    }

    void handleCancelBooking();
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
        {cancelError && dialogStep === null ? (
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
          <>
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
                    <strong>
                      {formatDateTime(booking.reservation_end_at)}
                    </strong>
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
                  <p>
                    {getCancellationPolicyMessage(booking, currentTime)}
                  </p>
                </div>
                {cancellationAllowed ? (
                  <button
                    className="button danger-button"
                    type="button"
                    onClick={() => {
                      setCancelError(null);
                      setCancelSuccess(null);
                      setDialogStep("policy");
                    }}
                    disabled={submittingCancellation}
                  >
                    Cancel Booking
                  </button>
                ) : null}
              </section>
            </article>

            {booking.cancellation_request ? (
              <section
                className="card cancellation-status-card"
                aria-labelledby="cancellation-status-title"
              >
                <div className="booking-card-header">
                  <div>
                    <span className="eyebrow">Cancellation Status</span>
                    <h2 id="cancellation-status-title">
                      Cancellation timeline
                    </h2>
                  </div>
                  <span className="status-pill">
                    {formatStatus(booking.cancellation_request.status)}
                  </span>
                </div>

                <div className="summary-list">
                  <div className="summary-row">
                    <span>Current status</span>
                    <strong>
                      {formatStatus(booking.cancellation_request.status)}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Requested</span>
                    <strong>
                      {formatDateTime(
                        booking.cancellation_request.created_at
                      )}
                    </strong>
                  </div>
                </div>

                {booking.cancellation_request.timeline.length === 0 ? (
                  <p className="empty-state">
                    No cancellation timeline events are available yet.
                  </p>
                ) : (
                  <ol className="timeline-list">
                    {booking.cancellation_request.timeline.map((event) => (
                      <li key={event.event_id}>
                        <div className="timeline-marker" aria-hidden="true" />
                        <div>
                          <strong>
                            {formatTimelineLabel(event.event_type)}
                          </strong>
                          <p>{event.message}</p>
                          <time dateTime={event.created_at}>
                            {formatDateTime(event.created_at)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ) : null}
          </>
        ) : null}

        {dialogStep !== null && booking ? (
          <div
            className="dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeCancellationDialog();
              }
            }}
          >
            {dialogStep === "policy" ? (
              <section
                aria-labelledby="cancel-dialog-title"
                aria-modal="true"
                className="dialog-card"
                role="dialog"
              >
                <h2 id="cancel-dialog-title">Cancel Booking</h2>
                <p>Are you sure you want to cancel this booking?</p>
                <div className="summary-list">
                  <div className="summary-row">
                    <span>Court</span>
                    <strong>{booking.court_name}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Date</span>
                    <strong>{formatDate(booking.reservation_start_at)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Start time</span>
                    <strong>{formatTime(booking.reservation_start_at)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>End time</span>
                    <strong>{formatTime(booking.reservation_end_at)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Total amount</span>
                    <strong>{formatBnd(booking.total_amount_bnd)}</strong>
                  </div>
                </div>
                <p className="notice">
                  Bookings can only be cancelled at least 24 hours before the
                  reservation start time. Eligible cancellations receive a full
                  refund.
                </p>
                <div className="actions">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={closeCancellationDialog}
                  >
                    Go Back
                  </button>
                  <button
                    className="button danger-button"
                    type="button"
                    onClick={() => setDialogStep("final")}
                  >
                    Proceed
                  </button>
                </div>
              </section>
            ) : (
              <section
                aria-labelledby="final-cancel-dialog-title"
                aria-modal="true"
                className="dialog-card"
                role="dialog"
              >
                <h2 id="final-cancel-dialog-title">
                  Final Cancellation Confirmation
                </h2>
                <p>
                  This action cannot be undone. Once cancelled, your booking
                  slot will be released and the refund workflow will begin if
                  eligible.
                </p>
                <form onSubmit={handleFinalConfirmation}>
                  <div className="field">
                    <label htmlFor="cancellation-confirmation">
                      Type {CANCELLATION_CONFIRMATION_PHRASE}
                    </label>
                    <input
                      id="cancellation-confirmation"
                      type="text"
                      value={confirmationPhrase}
                      onChange={(event) =>
                        setConfirmationPhrase(event.target.value)
                      }
                      autoComplete="off"
                      autoFocus
                      disabled={submittingCancellation}
                      aria-describedby="cancellation-confirmation-help"
                    />
                    <span
                      className="hint"
                      id="cancellation-confirmation-help"
                    >
                      Type CANCEL BOOKING to enable cancellation.
                    </span>
                  </div>
                  {cancelError ? (
                    <p className="alert" role="alert">
                      {cancelError}
                    </p>
                  ) : null}
                  <div className="actions">
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => {
                        setConfirmationPhrase("");
                        setCancelError(null);
                        setDialogStep("policy");
                      }}
                      disabled={submittingCancellation}
                    >
                      Go Back
                    </button>
                    <button
                      className="button danger-button"
                      type="submit"
                      disabled={
                        !confirmationPhraseMatches ||
                        submittingCancellation
                      }
                    >
                      {submittingCancellation
                        ? "Cancelling..."
                        : "Confirm Cancellation"}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        ) : null}
      </section>
    </AuthGuard>
  );
}
