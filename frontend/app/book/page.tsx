"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/AuthGuard";
import {
  apiFetch,
  ApiError,
  type AvailabilityResponse,
  type AvailabilitySlot,
  type BookingLockResponse,
  type CheckoutSessionResponse,
  type Court
} from "@/lib/api";

const OPENING_HOUR = 8;
const CLOSING_HOUR = 22;
const LAST_START_HOUR = 21;

function todayInBrunei(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Brunei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatBnd(amount: string | number): string {
  const numericAmount =
    typeof amount === "number" ? amount : Number.parseFloat(amount);
  return new Intl.NumberFormat("en-BN", {
    style: "currency",
    currency: "BND"
  }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function calculateTotal(slots: AvailabilitySlot[]): number {
  return slots.reduce(
    (total, slot) => total + Number.parseFloat(slot.price_bnd),
    0
  );
}

export default function BookPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayInBrunei());
  const [availability, setAvailability] =
    useState<AvailabilityResponse | null>(null);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [durationHours, setDurationHours] = useState(1);
  const [lock, setLock] = useState<BookingLockResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [locking, setLocking] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadCourts() {
      try {
        const result = await apiFetch<{ courts: Court[] }>("/api/courts");
        if (mounted) {
          setCourts(result.courts);
          setSelectedCourtId(result.courts[0]?.id ?? "");
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load courts."
          );
        }
      } finally {
        if (mounted) {
          setLoadingCourts(false);
        }
      }
    }

    loadCourts();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAvailability(null);
    setStartHour(null);
    setDurationHours(1);
    setLock(null);

    if (!selectedCourtId || !selectedDate) {
      return;
    }

    let mounted = true;

    async function loadAvailability() {
      setLoadingAvailability(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          court_id: selectedCourtId,
          date: selectedDate
        });
        const result = await apiFetch<AvailabilityResponse>(
          `/api/availability?${query.toString()}`
        );
        if (mounted) {
          setAvailability(result);
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load availability."
          );
        }
      } finally {
        if (mounted) {
          setLoadingAvailability(false);
        }
      }
    }

    loadAvailability();
    return () => {
      mounted = false;
    };
  }, [selectedCourtId, selectedDate]);

  const selectedCourt = courts.find((court) => court.id === selectedCourtId);

  const selectedSlots = useMemo(() => {
    if (!availability || startHour === null) {
      return [];
    }
    return availability.slots.filter(
      (slot) =>
        slot.start_hour >= startHour &&
        slot.start_hour < startHour + durationHours
    );
  }, [availability, durationHours, startHour]);

  const consecutiveAvailableSlots = useMemo(() => {
    if (!availability || startHour === null) {
      return [];
    }

    const slots: AvailabilitySlot[] = [];
    for (let hour = startHour; hour < CLOSING_HOUR; hour += 1) {
      const slot = availability.slots.find(
        (candidate) => candidate.start_hour === hour
      );
      if (!slot?.available) {
        break;
      }
      slots.push(slot);
    }
    return slots;
  }, [availability, startHour]);

  const validDurationCount = consecutiveAvailableSlots.length;
  const durationOptions = Array.from(
    { length: validDurationCount },
    (_, index) => index + 1
  );

  useEffect(() => {
    if (startHour !== null && validDurationCount > 0) {
      setDurationHours((currentDuration) =>
        Math.min(currentDuration, validDurationCount)
      );
    }
  }, [startHour, validDurationCount]);

  const blockedDurationMessage = useMemo(() => {
    if (!availability || startHour === null || validDurationCount === 0) {
      return null;
    }

    const blockingHour = startHour + validDurationCount;
    if (blockingHour >= CLOSING_HOUR) {
      return null;
    }

    const blockingSlot = availability.slots.find(
      (slot) => slot.start_hour === blockingHour
    );
    if (!blockingSlot || blockingSlot.available) {
      return null;
    }

    return `Longer duration is blocked because ${formatHour(
      blockingSlot.start_hour
    )}-${formatHour(blockingSlot.end_hour)} is unavailable.`;
  }, [availability, startHour, validDurationCount]);

  const selectionError = useMemo(() => {
    if (!selectedCourtId) {
      return "Select one court to continue.";
    }
    if (!selectedDate) {
      return "Select a booking date to continue.";
    }
    if (startHour === null) {
      return "Select a start time.";
    }
    if (durationHours < 1) {
      return "Duration must be at least 1 hour.";
    }
    if (startHour < OPENING_HOUR || startHour > LAST_START_HOUR) {
      return "Start time must be between 08:00 and 21:00.";
    }
    if (startHour + durationHours > CLOSING_HOUR) {
      return "Booking must end no later than 22:00.";
    }
    if (durationHours > validDurationCount) {
      return "Selected duration is longer than the consecutive available slots.";
    }
    if (selectedSlots.length !== durationHours) {
      return "Selected duration must use consecutive hourly slots.";
    }
    if (selectedSlots.some((slot) => !slot.available)) {
      return "Selected duration includes an unavailable slot.";
    }
    return null;
  }, [
    durationHours,
    selectedCourtId,
    selectedDate,
    selectedSlots,
    startHour,
    validDurationCount
  ]);

  const selectedTotal = calculateTotal(selectedSlots);
  const selectedEndHour =
    startHour === null ? null : startHour + durationHours;

  function chooseStartHour(hour: number) {
    setStartHour(hour);
    setDurationHours(1);
    setLock(null);
  }

  async function createLock() {
    if (selectionError || startHour === null) {
      return;
    }

    setLocking(true);
    setError(null);
    setLock(null);

    try {
      const result = await apiFetch<BookingLockResponse>(
        "/api/bookings/lock",
        {
          method: "POST",
          auth: true,
          body: {
            court_id: selectedCourtId,
            slot_date: selectedDate,
            start_hour: startHour,
            duration_hours: durationHours
          }
        }
      );
      setLock(result);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to create booking lock."
      );
    } finally {
      setLocking(false);
    }
  }

  async function continueToPayment() {
    if (!lock || creatingCheckout) {
      return;
    }

    setCreatingCheckout(true);
    setError(null);

    try {
      const result = await apiFetch<CheckoutSessionResponse>(
        "/api/payments/checkout-session",
        {
          method: "POST",
          auth: true,
          body: {
            booking_id: lock.booking_id
          }
        }
      );
      const checkoutUrl = result.checkout_url ?? result.url;
      if (!checkoutUrl) {
        throw new ApiError("Checkout session did not include a payment URL.");
      }
      window.location.assign(checkoutUrl);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to start payment. Please try again."
      );
      setCreatingCheckout(false);
    }
  }

  return (
    <AuthGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Book one court</span>
          <h1 className="page-title">Choose a court and hourly slots.</h1>
          <p className="lede">
            Open daily from 08:00 to 22:00. Last booking starts at 21:00.
          </p>
        </div>

        <div className="booking-layout">
          <div className="grid">
            <section className="card" aria-labelledby="court-heading">
              <h2 id="court-heading">1. Select court</h2>
              {loadingCourts ? (
                <p className="loading">Loading courts...</p>
              ) : null}
              {!loadingCourts && courts.length === 0 ? (
                <p className="empty-state">No active courts are available.</p>
              ) : null}
              <div className="court-grid">
                {courts.map((court) => (
                  <button
                    key={court.id}
                    className="court-button"
                    type="button"
                    aria-pressed={court.id === selectedCourtId}
                    onClick={() => setSelectedCourtId(court.id)}
                  >
                    <strong>{court.name}</strong>
                    <span className="meta-line">
                      {court.location}
                      <span className="status-dot">Active</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="card" aria-labelledby="date-heading">
              <h2 id="date-heading">2. Select date</h2>
              <div className="field">
                <label htmlFor="booking-date">Booking date</label>
                <input
                  id="booking-date"
                  type="date"
                  min={todayInBrunei()}
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </section>

            <section className="card" aria-labelledby="slots-heading">
              <h2 id="slots-heading">3. Select start hour</h2>
              {loadingAvailability ? (
                <p className="loading">Loading availability...</p>
              ) : null}
              {!loadingAvailability && !availability ? (
                <p className="empty-state">
                  Select a court and date to see hourly availability.
                </p>
              ) : null}
              {availability ? (
                <div className="slot-grid">
                  {availability.slots.map((slot) => (
                    <button
                      key={slot.start_hour}
                      className="slot-button"
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={slot.start_hour === startHour}
                      onClick={() => chooseStartHour(slot.start_hour)}
                    >
                      <strong>
                        {formatHour(slot.start_hour)}-{formatHour(slot.end_hour)}
                      </strong>
                      <span className="meta-line">
                        {formatBnd(slot.price_bnd)}
                        <span
                          className={
                            slot.available
                              ? "status-dot"
                              : "status-dot unavailable"
                          }
                        >
                          {slot.available ? "Available" : "Unavailable"}
                        </span>
                      </span>
                      {!slot.available && slot.unavailable_reason ? (
                        <span className="hint">
                          Reason: {slot.unavailable_reason}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="card" aria-labelledby="summary-heading">
            <h2 id="summary-heading">Booking summary</h2>
            <div className="summary-list">
              <div className="summary-row">
                <span>Court</span>
                <strong>{selectedCourt?.name ?? "Not selected"}</strong>
              </div>
              <div className="summary-row">
                <span>Date</span>
                <strong>{selectedDate || "Not selected"}</strong>
              </div>
              <div className="summary-row">
                <span>Start</span>
                <strong>
                  {startHour === null ? "Not selected" : formatHour(startHour)}
                </strong>
              </div>
              <div className="summary-row">
                <span>End</span>
                <strong>
                  {selectedEndHour === null
                    ? "Not selected"
                    : formatHour(selectedEndHour)}
                </strong>
              </div>
              <div className="summary-row">
                <span>Duration</span>
                <strong>{durationHours} hour(s)</strong>
              </div>
            </div>

            <div className="field" style={{ marginTop: "1rem" }}>
              <label htmlFor="duration">Duration</label>
              <select
                id="duration"
                value={durationHours}
                disabled={startHour === null || durationOptions.length === 0}
                onChange={(event) =>
                  setDurationHours(Number(event.target.value))
                }
              >
                {durationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} hour{duration === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
              <span className="hint">
                Multiple hours must be consecutive on the same court.
              </span>
              {blockedDurationMessage ? (
                <span className="hint">{blockedDurationMessage}</span>
              ) : null}
            </div>

            <div className="summary-list">
              <div className="summary-row">
                <span>Total</span>
                <strong>{formatBnd(selectedTotal)}</strong>
              </div>
            </div>

            {selectionError ? (
              <p className="notice" role="status">
                {selectionError}
              </p>
            ) : null}

            <button
              className="button"
              type="button"
              disabled={Boolean(selectionError) || locking}
              onClick={createLock}
              style={{ width: "100%", marginTop: "1rem" }}
            >
              {locking ? "Creating lock..." : "Create temporary lock"}
            </button>

            {error ? <p className="alert" role="alert">{error}</p> : null}

            {lock ? (
              <section className="notice" aria-labelledby="lock-heading">
                <h3 id="lock-heading">Booking locked</h3>
                <p>
                  Booking ID: <strong>{lock.booking_id}</strong>
                </p>
                <p>
                  Time: {formatDateTime(lock.reservation_start_at)} to{" "}
                  {formatDateTime(lock.reservation_end_at)}
                </p>
                <p>Duration: {lock.duration_hours} hour(s)</p>
                <p>Total: {formatBnd(lock.total_amount_bnd)}</p>
                <p>Lock expires: {formatDateTime(lock.lock_expires_at)}</p>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={creatingCheckout}
                  style={{ marginTop: "0.75rem" }}
                  onClick={continueToPayment}
                >
                  {creatingCheckout
                    ? "Opening Stripe Checkout..."
                    : "Continue to Payment"}
                </button>
                <p className="hint">
                  You will be redirected to Stripe Checkout to complete payment.
                </p>
              </section>
            ) : null}
          </aside>
        </div>
      </section>
    </AuthGuard>
  );
}
