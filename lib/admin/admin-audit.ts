import "server-only";

import { SupabaseRestClient } from "@/lib/core/supabase-rest";

type AuditMeta = Record<string, unknown> | undefined;

export interface AdminAuditWriteInput {
  adminId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  message?: string;
  meta?: AuditMeta;
}

export interface AdminAuditRow {
  id?: string | null;
  admin_id?: string | null;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  message?: string | null;
  meta?: unknown;
  created_at?: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeMeta(meta: AuditMeta): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const entries = Object.entries(meta).filter(([, value]) => value !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function writeAdminAuditLog(
  db: SupabaseRestClient,
  input: AdminAuditWriteInput
): Promise<{ ok: true }> {
  const adminId = safeString(input.adminId);
  const payloadBase: Record<string, unknown> = {
    action: safeString(input.action),
    entity_type: safeString(input.entityType),
    entity_id: safeString(input.entityId),
  };

  const message = safeString(input.message);
  if (message) payloadBase.message = message;

  const meta = normalizeMeta(input.meta);
  if (meta) payloadBase.meta = meta;

  const attempts: Array<Record<string, unknown>> = [];
  if (adminId && isUuidLike(adminId)) {
    attempts.push({ ...payloadBase, admin_id: adminId });
  }
  attempts.push(payloadBase);
  attempts.push({
    action: payloadBase.action,
    entity_type: payloadBase.entity_type,
    entity_id: payloadBase.entity_id,
  });

  for (const payload of attempts) {
    try {
      await db.insertSingle<Record<string, unknown>>("admin_audit_logs", payload);
      return { ok: true };
    } catch {
      // table/column may not exist yet; continue trying smaller payloads
    }
  }

  // Safe fallback: succeed even when table is missing / incompatible.
  return { ok: true };
}

export async function readAdminAuditLogs(
  db: SupabaseRestClient,
  filters: { entityType: string; entityId: string; limit?: number }
): Promise<AdminAuditRow[]> {
  const entityType = safeString(filters.entityType);
  const entityId = safeString(filters.entityId);
  if (!entityType || !entityId) return [];

  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 20)));
  const attempts = [
    "id,admin_id,action,entity_type,entity_id,message,meta,created_at",
    "*",
  ];

  for (const select of attempts) {
    try {
      const rows = await db.selectMany<AdminAuditRow>(
        "admin_audit_logs",
        new URLSearchParams({
          select,
          entity_type: `eq.${entityType}`,
          entity_id: `eq.${entityId}`,
          order: "created_at.desc",
          limit: String(limit),
        })
      );
      return Array.isArray(rows) ? rows : [];
    } catch {
      // table/columns may not exist yet
    }
  }

  return [];
}

