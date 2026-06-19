import type { Request } from "express";

import { auditRepository } from "./audit.repository.js";
import type { AuditLogsQuery } from "./audit.schemas.js";

const SENSITIVE_KEYS = [
  "authorization",
  "cookie",
  "jwt",
  "otp",
  "password",
  "pepper",
  "secret",
  "stripe_signature",
  "token"
];

interface AuditActor {
  userId: string | null;
  role: "customer" | "admin" | "system";
  name?: string | null;
}

interface AuditInput {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[TRUNCATED]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? "[REDACTED]" : sanitizeValue(entry, depth + 1)
      ])
    );
  }
  if (typeof value === "string") {
    return value.slice(0, 2000);
  }
  return value;
}

function getRequestIp(request?: Request): string | null {
  if (!request) {
    return null;
  }
  return request.ip?.slice(0, 200) ?? null;
}

function getUserAgent(request?: Request): string | null {
  return request?.header("user-agent")?.slice(0, 1000) ?? null;
}

export const auditService = {
  async record(input: AuditInput): Promise<void> {
    try {
      await auditRepository.create({
        actorUserId: input.actor.userId,
        actorRole: input.actor.role,
        actorName: input.actor.name ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 1000),
        metadata: sanitizeValue(input.metadata ?? {}) as Record<string, unknown>,
        ipAddress: getRequestIp(input.request),
        userAgent: getUserAgent(input.request)
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Audit log write failed",
          action: input.action,
          entity_type: input.entityType,
          entity_id: input.entityId ?? null,
          error: error instanceof Error ? error.message : "Unknown audit error"
        })
      );
    }
  },

  async getLogs(filters: AuditLogsQuery) {
    const result = await auditRepository.findMany(filters);
    return {
      logs: result.rows.map((row) => ({
        id: row.id,
        actor_user_id: row.actor_user_id,
        actor_role: row.actor_role,
        actor_name: row.actor_name,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        summary: row.summary,
        metadata: row.metadata,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at.toISOString()
      })),
      page: filters.page,
      page_size: filters.page_size,
      total: result.total
    };
  }
};
