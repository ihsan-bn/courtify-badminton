"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import {
  apiFetch,
  ApiError,
  type AdminCancellationQueueItem
} from "@/lib/api";

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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

export default function AdminCancellationsPage() {
  const [requests, setRequests] = useState<AdminCancellationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRequests() {
      try {
        const result = await apiFetch<{
          cancellation_requests: AdminCancellationQueueItem[];
        }>("/api/admin/cancellation-requests", { auth: true });
        if (mounted) {
          setRequests(
            result.cancellation_requests.filter(
              (request) => request.status === "pending_admin_review"
            )
          );
        }
      } catch (caught) {
        if (mounted) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "Unable to load cancellation requests."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadRequests();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AdminGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Administrator</span>
          <h1 className="page-title">Cancellation queue.</h1>
          <p className="lede">
            Review pending customer cancellation requests before releasing
            reserved court slots.
          </p>
          <div className="actions">
            <Link className="button-secondary" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="loading">Loading cancellation requests...</p>
        ) : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && requests.length === 0 ? (
          <section className="empty-state">
            <h2>No pending cancellation requests</h2>
            <p>New customer requests will appear here for administrator review.</p>
          </section>
        ) : null}

        {!loading && !error && requests.length > 0 ? (
          <div className="booking-list">
            {requests.map((request) => (
              <article
                className="card booking-card"
                key={request.cancellation_request_id}
              >
                <div className="booking-card-header">
                  <div>
                    <h2>{request.court_name}</h2>
                    <p>
                      {request.customer_name ?? "Customer"} ·{" "}
                      {request.customer_phone_number}
                    </p>
                  </div>
                  <span className="status-pill status-cancellation_requested">
                    {formatStatus(request.status)}
                  </span>
                </div>

                <div className="grid two">
                  <div className="summary-list">
                    <div className="summary-row">
                      <span>Booking date</span>
                      <strong>
                        {formatDateTime(request.reservation_start_at)}
                      </strong>
                    </div>
                    <div className="summary-row">
                      <span>Requested</span>
                      <strong>{formatDateTime(request.requested_at)}</strong>
                    </div>
                  </div>
                  <div className="summary-list">
                    <div className="summary-row">
                      <span>Total</span>
                      <strong>{formatBnd(request.total_amount_bnd)}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Booking ID</span>
                      <strong className="reference-value">
                        {request.booking_id}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="actions">
                  <Link
                    className="button-secondary"
                    href={`/admin/cancellations/${request.cancellation_request_id}`}
                  >
                    View Details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </AdminGuard>
  );
}
