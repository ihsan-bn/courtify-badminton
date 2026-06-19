import { query } from "../../config/database.js";
import type { AuditLogsQuery } from "./audit.schemas.js";

export interface CreateAuditLogRecord {
  actorUserId: string | null;
  actorRole: "customer" | "admin" | "system";
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  actor_role: "customer" | "admin" | "system";
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export const auditRepository = {
  async create(input: CreateAuditLogRecord): Promise<void> {
    await query(
      `
        insert into public.audit_logs (
          actor_user_id,
          actor_role,
          actor_name,
          action,
          entity_type,
          entity_id,
          summary,
          metadata,
          ip_address,
          user_agent
        )
        values (
          $1,
          $2,
          coalesce(
            $3,
            (select name from public.users where id = $1)
          ),
          $4,
          $5,
          $6,
          $7,
          $8::jsonb,
          $9,
          $10
        )
      `,
      [
        input.actorUserId,
        input.actorRole,
        input.actorName,
        input.action,
        input.entityType,
        input.entityId,
        input.summary,
        JSON.stringify(input.metadata),
        input.ipAddress,
        input.userAgent
      ]
    );
  },

  async findMany(
    filters: AuditLogsQuery
  ): Promise<{ rows: AuditLogRecord[]; total: number }> {
    const offset = (filters.page - 1) * filters.page_size;
    const values = [
      filters.action ?? null,
      filters.actor_user_id ?? null,
      filters.entity_type ?? null,
      filters.entity_id ?? null,
      filters.from ?? null,
      filters.to ?? null
    ];
    const filterSql = `
      where ($1::text is null or audit.action = $1)
        and ($2::uuid is null or audit.actor_user_id = $2)
        and ($3::text is null or audit.entity_type = $3)
        and ($4::uuid is null or audit.entity_id = $4)
        and (
          $5::date is null
          or (audit.created_at at time zone 'Asia/Brunei')::date >= $5
        )
        and (
          $6::date is null
          or (audit.created_at at time zone 'Asia/Brunei')::date <= $6
        )
    `;
    const [result, countResult] = await Promise.all([
      query<AuditLogRecord>(
      `
        select
          audit.id,
          audit.actor_user_id,
          audit.actor_role,
          audit.actor_name,
          audit.action,
          audit.entity_type,
          audit.entity_id,
          audit.summary,
          audit.metadata,
          audit.ip_address,
          audit.user_agent,
          audit.created_at
        from public.audit_logs as audit
        ${filterSql}
        order by audit.created_at desc, audit.id desc
        limit $7
        offset $8
      `,
        [...values, filters.page_size, offset]
      ),
      query<{ total: string }>(
        `
          select count(*)::text as total
          from public.audit_logs as audit
          ${filterSql}
        `,
        values
      )
    ]);

    const total = Number.parseInt(countResult.rows[0]?.total ?? "0", 10);
    return {
      rows: result.rows,
      total: Number.isSafeInteger(total) ? total : 0
    };
  }
};
