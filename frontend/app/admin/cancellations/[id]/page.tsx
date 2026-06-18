"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import {
  apiFetch,
  ApiError,
  type AdminCancellationAction,
  type AdminCancellationDetail
} from "@/lib/api";

const ACTION_LABELS: Record<AdminCancellationAction, string> = {
  admin_verifying_cancellation: "Admin Verifying Cancellation",
  customer_contacted: "Customer Contacted",
  cancellation_approved: "Cancellation Approved",
  cancellation_rejected: "Cancellation Rejected"
};

const TIMELINE_LABELS: Record<string, string> = {
  customer_requested_cancellation: "Cancellation requested by customer",
  pending_admin_review: "Pending admin review",
  admin_verifying_cancellation: "Admin verifying cancellation",
  customer_contacted: "Customer contacted",
  cancellation_approved: "Cancellation approved",
  cancellation_rejected: "Cancellation rejected"
};

function getRouteId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

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

function formatStatus(value: string): string {
  return value.replaceAll("_", " ");
}

export default function AdminCancellationDetailsPage() {
  const params = useParams();
  const requestId = getRouteId(params.id);
  const [request, setRequest] = useState<AdminCancellationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] =
    useState<AdminCancellationAction | null>(null);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setError("Cancellation request not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{
        cancellation_request: AdminCancellationDetail;
      }>(`/api/admin/cancellation-requests/${requestId}`, { auth: true });
      setRequest(result.cancellation_request);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to load cancellation request."
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function applyAction(action: AdminCancellationAction) {
    if (submittingAction) {
      return;
    }

    setSubmittingAction(action);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/admin/cancellation-requests/${requestId}/events`, {
        method: "POST",
        auth: true,
        body: { action }
      });
      setSuccess(`${ACTION_LABELS[action]} recorded.`);
      await loadRequest();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to update the cancellation request."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  const pending = request?.status === "pending_admin_review";

  return (
    <AdminGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Administrator</span>
          <h1 className="page-title">Cancellation review.</h1>
          <p className="lede">
            Review the customer, booking, reserved slots, and cancellation
            timeline before choosing a final action.
          </p>
          <div className="actions">
            <Link className="button-secondary" href="/admin/cancellations">
              Back to Cancellation Queue
            </Link>
            <Link className="button-secondary" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>

        {loading ? <p className="loading">Loading request details...</p> : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="success" role="status">
            {success}
          </p>
        ) : null}

        {!loading && request ? (
          <>
            <section className="card booking-card">
              <div className="booking-card-header">
                <div>
                  <h2>{request.court_name}</h2>
                  <p>{request.court_location}</p>
                </div>
                <span className="status-pill status-cancellation_requested">
                  {formatStatus(request.status)}
                </span>
              </div>

              <div className="grid two">
                <div className="summary-list">
                  <div className="summary-row">
                    <span>Customer</span>
                    <strong>{request.customer_name ?? "Not provided"}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Phone</span>
                    <strong>{request.customer_phone_number}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Email</span>
                    <strong>{request.customer_email ?? "Not provided"}</strong>
                  </div>
                </div>
                <div className="summary-list">
                  <div className="summary-row">
                    <span>Booking status</span>
                    <strong>{formatStatus(request.booking_status)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Starts</span>
                    <strong>
                      {formatDateTime(request.reservation_start_at)}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Ends</span>
                    <strong>{formatDateTime(request.reservation_end_at)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Total</span>
                    <strong>{formatBnd(request.total_amount_bnd)}</strong>
                  </div>
                </div>
              </div>

              <section aria-label="Reserved booking slots">
                <h3>Slots</h3>
                {request.slots.length === 0 ? (
                  <p className="empty-state">
                    No slot rows remain attached to this booking.
                  </p>
                ) : (
                  <ul className="slot-list">
                    {request.slots.map((slot) => (
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
            </section>

            <section className="card cancellation-status-card">
              <div className="booking-card-header">
                <div>
                  <span className="eyebrow">Workflow</span>
                  <h2>Cancellation timeline</h2>
                </div>
                <span className="status-pill">
                  {formatStatus(request.status)}
                </span>
              </div>

              {request.timeline.length === 0 ? (
                <p className="empty-state">No timeline events are available.</p>
              ) : (
                <ol className="timeline-list">
                  {request.timeline.map((event) => (
                    <li key={event.event_id}>
                      <div className="timeline-marker" aria-hidden="true" />
                      <div>
                        <strong>
                          {TIMELINE_LABELS[event.event_type] ??
                            formatStatus(event.event_type)}
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

            <section className="card admin-action-card">
              <h2>Administrator actions</h2>
              {pending ? (
                <>
                  <p>
                    Progress updates appear immediately in the customer
                    timeline. Approval releases slots; rejection restores the
                    booking to confirmed.
                  </p>
                  <div className="actions">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() =>
                        void applyAction("admin_verifying_cancellation")
                      }
                    >
                      Admin Verifying Cancellation
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void applyAction("customer_contacted")}
                    >
                      Customer Contacted
                    </button>
                    <button
                      className="button"
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void applyAction("cancellation_approved")}
                    >
                      Cancellation Approved
                    </button>
                    <button
                      className="button danger-button"
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void applyAction("cancellation_rejected")}
                    >
                      Cancellation Rejected
                    </button>
                  </div>
                  {submittingAction ? (
                    <p className="loading">
                      Recording {ACTION_LABELS[submittingAction]}...
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  This request has completed administrator review with status{" "}
                  <strong>{formatStatus(request.status)}</strong>.
                </p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </AdminGuard>
  );
}
