"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState
} from "react";

import { AdminGuard } from "@/components/AdminGuard";
import {
  apiFetch,
  ApiError,
  downloadApiFile,
  type AdminCancellationAction,
  type AdminCancellationDetail,
  type RefundMethod
} from "@/lib/api";

const ACTION_LABELS: Record<AdminCancellationAction, string> = {
  admin_verifying_cancellation: "Admin Verifying Cancellation",
  customer_contacted: "Customer Contacted",
  cancellation_approved: "Cancellation Approved",
  cancellation_rejected: "Cancellation Rejected",
  refund_in_progress: "Refund In Progress",
  refund_completed: "Refund Completed",
  close_case: "Close Case"
};

const TIMELINE_LABELS: Record<string, string> = {
  customer_requested_cancellation: "Cancellation requested by customer",
  pending_admin_review: "Pending admin review",
  admin_verifying_cancellation: "Admin verifying cancellation",
  customer_contacted: "Customer contacted",
  cancellation_approved: "Cancellation approved",
  cancellation_rejected: "Cancellation rejected",
  refund_in_progress: "Refund in progress",
  refund_completed: "Refund completed",
  close_case: "Case closed"
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  booking_confirmation: "Booking confirmation",
  cancellation_request_received: "Cancellation request received",
  cancellation_approved: "Cancellation approved",
  refund_completed: "Refund completed",
  case_closed: "Case closed"
};

const REFUND_METHODS: RefundMethod[] = [
  "BIBD Transfer",
  "Baiduri Transfer",
  "Cash",
  "Bank Transfer",
  "Other"
];

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
  const [refundMethod, setRefundMethod] = useState<RefundMethod | "">("");
  const [refundReference, setRefundReference] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [downloadingSummary, setDownloadingSummary] = useState(false);

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

  async function applyAction(
    action: AdminCancellationAction,
    refundDetails?: {
      refund_method: RefundMethod;
      refund_reference: string;
      refund_notes: string;
    }
  ) {
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
        body: {
          action,
          ...refundDetails
        }
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

  function submitRefundCompleted(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refundMethod || !refundReference.trim() || !refundNotes.trim()) {
      return;
    }

    void applyAction("refund_completed", {
      refund_method: refundMethod,
      refund_reference: refundReference.trim(),
      refund_notes: refundNotes.trim()
    });
  }

  async function downloadCaseSummary() {
    if (!request || downloadingSummary) {
      return;
    }

    setDownloadingSummary(true);
    setError(null);
    try {
      await downloadApiFile(
        `/api/admin/cancellations/${request.request_id}/case-summary`,
        `courtify-cancellation-case-${request.request_id}.pdf`
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to download the case summary."
      );
    } finally {
      setDownloadingSummary(false);
    }
  }

  const reviewInProgress =
    request?.status === "pending_admin_review" ||
    request?.status === "admin_verifying" ||
    request?.status === "customer_contacted";

  return (
    <AdminGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Administrator</span>
          <h1 className="page-title">Cancellation review.</h1>
          <p className="lede">
            Review the cancellation case, record manual refund progress, and
            keep the customer timeline current.
          </p>
          <div className="actions">
            <Link className="button-secondary" href="/admin/cancellations">
              Back to Cancellation Queue
            </Link>
            <Link className="button-secondary" href="/dashboard">
              Dashboard
            </Link>
            {request ? (
              <button
                className="button"
                type="button"
                disabled={downloadingSummary}
                onClick={() => void downloadCaseSummary()}
              >
                {downloadingSummary
                  ? "Preparing summary..."
                  : "Download Case Summary"}
              </button>
            ) : null}
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
              <div className="booking-card-header">
                <div>
                  <span className="eyebrow">Manual Refund</span>
                  <h2>Refund details</h2>
                </div>
                <span className="status-pill">
                  {formatStatus(request.status)}
                </span>
              </div>
              <div className="summary-list">
                <div className="summary-row">
                  <span>Refund status</span>
                  <strong>{formatStatus(request.status)}</strong>
                </div>
                <div className="summary-row">
                  <span>Refund date</span>
                  <strong>
                    {request.refunded_at
                      ? formatDateTime(request.refunded_at)
                      : "Not completed"}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Refund method</span>
                  <strong>{request.refund_method ?? "Not recorded"}</strong>
                </div>
                <div className="summary-row">
                  <span>Refund reference</span>
                  <strong className="reference-value">
                    {request.refund_reference ?? "Not recorded"}
                  </strong>
                </div>
                <div className="summary-row">
                  <span>Refund notes</span>
                  <strong className="reference-value">
                    {request.refund_notes ?? "Not recorded"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="card admin-action-card">
              <div className="booking-card-header">
                <div>
                  <span className="eyebrow">Transactional Email</span>
                  <h2>Email delivery history</h2>
                </div>
                <span className="status-pill">
                  {request.email_history.length}
                </span>
              </div>
              {request.email_history.length === 0 ? (
                <p className="empty-state">
                  No transactional email attempts are recorded for this
                  booking.
                </p>
              ) : (
                <div className="operations-list">
                  {request.email_history.map((email) => (
                    <article
                      className="operations-row"
                      key={`${email.email_type}-${email.created_at}`}
                    >
                      <div>
                        <strong>
                          {EMAIL_TYPE_LABELS[email.email_type] ??
                            formatStatus(email.email_type)}
                        </strong>
                        <p>
                          {email.sent_at
                            ? `Sent ${formatDateTime(email.sent_at)}`
                            : `Attempted ${formatDateTime(email.created_at)}`}
                        </p>
                      </div>
                      <span
                        className={`status-pill email-status-${email.delivery_status}`}
                      >
                        {email.delivery_status}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="card admin-action-card">
              <h2>Administrator actions</h2>
              {reviewInProgress ? (
                <>
                  <p>
                    Record review progress, then approve or reject the
                    cancellation.
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
                </>
              ) : request.status === "approved" ? (
                <>
                  <p>
                    Cancellation is approved. Start tracking the manual refund
                    when processing begins.
                  </p>
                  <div className="actions">
                    <button
                      className="button"
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void applyAction("refund_in_progress")}
                    >
                      Refund In Progress
                    </button>
                  </div>
                </>
              ) : request.status === "refund_in_progress" ? (
                <form
                  className="refund-form"
                  onSubmit={submitRefundCompleted}
                >
                  <p>
                    Record the completed manual refund. All fields are
                    required.
                  </p>
                  <div className="field">
                    <label htmlFor="refund-method">Refund Method</label>
                    <select
                      id="refund-method"
                      value={refundMethod}
                      onChange={(event) =>
                        setRefundMethod(event.target.value as RefundMethod | "")
                      }
                      disabled={submittingAction !== null}
                      required
                    >
                      <option value="">Select refund method</option>
                      {REFUND_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="refund-reference">
                      Refund Reference Number
                    </label>
                    <input
                      id="refund-reference"
                      value={refundReference}
                      onChange={(event) =>
                        setRefundReference(event.target.value)
                      }
                      maxLength={200}
                      disabled={submittingAction !== null}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="refund-notes">Refund Notes</label>
                    <textarea
                      id="refund-notes"
                      value={refundNotes}
                      onChange={(event) => setRefundNotes(event.target.value)}
                      maxLength={2000}
                      disabled={submittingAction !== null}
                      required
                    />
                  </div>
                  <div className="actions">
                    <button
                      className="button"
                      type="submit"
                      disabled={
                        submittingAction !== null ||
                        !refundMethod ||
                        !refundReference.trim() ||
                        !refundNotes.trim()
                      }
                    >
                      Refund Completed
                    </button>
                  </div>
                </form>
              ) : request.status === "refund_completed" ? (
                <>
                  <p>
                    The manual refund is recorded. Close the case after final
                    review.
                  </p>
                  <div className="actions">
                    <button
                      className="button"
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => void applyAction("close_case")}
                    >
                      Close Case
                    </button>
                  </div>
                </>
              ) : (
                <p>
                  This case is read-only with status{" "}
                  <strong>{formatStatus(request.status)}</strong>.
                </p>
              )}
              {submittingAction ? (
                <p className="loading">
                  Recording {ACTION_LABELS[submittingAction]}...
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </section>
    </AdminGuard>
  );
}
