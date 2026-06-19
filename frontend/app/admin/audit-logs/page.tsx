"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { AdminGuard } from "@/components/AdminGuard";
import {
  apiFetch,
  ApiError,
  type AuditLog,
  type AuditLogsResponse
} from "@/lib/api";

interface AuditFilters {
  action: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: AuditFilters = {
  action: "",
  actorUserId: "",
  entityType: "",
  entityId: "",
  from: "",
  to: ""
};

const PAGE_SIZE = 25;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-BN", {
    timeZone: "Asia/Brunei",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function buildQuery(filters: AuditFilters, page: number): string {
  const query = new URLSearchParams({
    page: page.toString(),
    page_size: PAGE_SIZE.toString()
  });
  if (filters.action.trim()) query.set("action", filters.action.trim());
  if (filters.actorUserId.trim()) {
    query.set("actor_user_id", filters.actorUserId.trim());
  }
  if (filters.entityType.trim()) {
    query.set("entity_type", filters.entityType.trim());
  }
  if (filters.entityId.trim()) {
    query.set("entity_id", filters.entityId.trim());
  }
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  return query.toString();
}

function MetadataDetails({ log }: { log: AuditLog }) {
  const hasMetadata = Object.keys(log.metadata).length > 0;
  return (
    <details className="audit-metadata">
      <summary>View metadata</summary>
      <dl>
        <div>
          <dt>Entity ID</dt>
          <dd className="reference-value">{log.entity_id ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Actor user ID</dt>
          <dd className="reference-value">
            {log.actor_user_id ?? "System actor"}
          </dd>
        </div>
      </dl>
      {hasMetadata ? (
        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
      ) : (
        <p className="hint">No additional metadata was recorded.</p>
      )}
    </details>
  );
}

export default function AdminAuditLogsPage() {
  const [draftFilters, setDraftFilters] =
    useState<AuditFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [result, setResult] = useState<AuditLogsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<AuditLogsResponse>(
        `/api/admin/audit-logs?${buildQuery(filters, page)}`,
        { auth: true }
      );
      setResult(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to load audit logs."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function resetFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const totalPages = Math.max(
    1,
    Math.ceil((result?.total ?? 0) / PAGE_SIZE)
  );

  return (
    <AdminGuard>
      <section className="page">
        <div>
          <span className="eyebrow">Administrator Accountability</span>
          <h1 className="page-title">Audit logs.</h1>
          <p className="lede">
            Review important customer, administrator, and system actions
            recorded by Courtify-Badminton.
          </p>
          <div className="actions">
            <Link className="button-secondary" href="/admin/dashboard">
              Back to Dashboard
            </Link>
            <Link className="button-secondary" href="/admin/reports">
              Business Reports
            </Link>
          </div>
        </div>

        <form className="card audit-filter-form" onSubmit={applyFilters}>
          <div>
            <span className="eyebrow">Filters</span>
            <h2>Find audit events</h2>
          </div>
          <div className="audit-filter-grid">
            <div className="field">
              <label htmlFor="audit-action">Action</label>
              <input
                id="audit-action"
                value={draftFilters.action}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    action: event.target.value
                  }))
                }
                placeholder="refund_completed"
                maxLength={100}
              />
            </div>
            <div className="field">
              <label htmlFor="audit-actor">Actor user ID</label>
              <input
                id="audit-actor"
                value={draftFilters.actorUserId}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    actorUserId: event.target.value
                  }))
                }
                placeholder="UUID"
              />
            </div>
            <div className="field">
              <label htmlFor="audit-entity-type">Entity type</label>
              <input
                id="audit-entity-type"
                value={draftFilters.entityType}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    entityType: event.target.value
                  }))
                }
                placeholder="booking"
                maxLength={100}
              />
            </div>
            <div className="field">
              <label htmlFor="audit-entity-id">Entity ID</label>
              <input
                id="audit-entity-id"
                value={draftFilters.entityId}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    entityId: event.target.value
                  }))
                }
                placeholder="UUID"
              />
            </div>
            <div className="field">
              <label htmlFor="audit-from">From date</label>
              <input
                id="audit-from"
                type="date"
                value={draftFilters.from}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    from: event.target.value
                  }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="audit-to">To date</label>
              <input
                id="audit-to"
                type="date"
                value={draftFilters.to}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    to: event.target.value
                  }))
                }
              />
            </div>
          </div>
          <div className="actions">
            <button className="button" type="submit" disabled={loading}>
              Apply Filters
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={resetFilters}
              disabled={loading}
            >
              Reset Filters
            </button>
          </div>
        </form>

        {loading ? <p className="loading">Loading audit logs...</p> : null}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && result?.logs.length === 0 ? (
          <section className="empty-state">
            <h2>No audit events found</h2>
            <p>Adjust the filters or wait for new workflow activity.</p>
          </section>
        ) : null}

        {!loading && !error && result && result.logs.length > 0 ? (
          <>
            <div className="audit-card-list">
              {result.logs.map((log) => (
                <article className="card audit-log-card" key={log.id}>
                  <div className="booking-card-header">
                    <div>
                      <strong>{formatLabel(log.action)}</strong>
                      <p>{formatDateTime(log.created_at)}</p>
                    </div>
                    <span className="status-pill">{log.actor_role}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Actor</dt>
                      <dd>{log.actor_name ?? "System"}</dd>
                    </div>
                    <div>
                      <dt>Entity</dt>
                      <dd>{formatLabel(log.entity_type)}</dd>
                    </div>
                    <div>
                      <dt>Summary</dt>
                      <dd>{log.summary}</dd>
                    </div>
                  </dl>
                  <MetadataDetails log={log} />
                </article>
              ))}
            </div>
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Role</th>
                    <th>Entity</th>
                    <th>Summary</th>
                    <th>Created</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {result.logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <strong>{formatLabel(log.action)}</strong>
                      </td>
                      <td>{log.actor_name ?? "System"}</td>
                      <td>
                        <span className="status-pill">{log.actor_role}</span>
                      </td>
                      <td>
                        <span>{formatLabel(log.entity_type)}</span>
                      </td>
                      <td>{log.summary}</td>
                      <td>
                        <time dateTime={log.created_at}>
                          {formatDateTime(log.created_at)}
                        </time>
                      </td>
                      <td>
                        <MetadataDetails log={log} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="audit-pagination" aria-label="Audit log pages">
              <button
                className="button-secondary"
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span>
                Page {result.page} of {totalPages} ({result.total} events)
              </span>
              <button
                className="button-secondary"
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : null}
      </section>
    </AdminGuard>
  );
}
