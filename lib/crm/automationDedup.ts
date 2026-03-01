import "server-only";

import { randomUUID } from "node:crypto";
import { SupabaseRestClient } from "@/lib/core/supabase-rest";

type GenericRow = Record<string, unknown>;

export interface CrmAutomationDedupCheckInput {
  dedupKey: string;
  event: string;
  leadId: string;
  scopeValue?: string | null;
}

export interface CrmAutomationDedupCheckResult {
  shouldRun: boolean;
  deduped: boolean;
  storage: "automation_dedup" | "system_logs";
  reason: "reserved" | "duplicate" | "fallback_reserved" | "fallback_duplicate";
}

const DEDUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("23505") ||
    message.includes("duplicate key") ||
    message.includes("unique constraint")
  );
}

async function safeSelectMany(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<GenericRow[] | null> {
  try {
    const rows = await db.selectMany<GenericRow>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return null;
  }
}

async function safeInsert(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; duplicate: boolean }> {
  try {
    await db.insertSingle<GenericRow>(table, payload);
    return { ok: true };
  } catch (error) {
    return { ok: false, duplicate: looksLikeUniqueViolation(error) };
  }
}

function readDedupKey(row: GenericRow): string {
  return (
    safeString(row.dedup_key) ||
    safeString(row.key) ||
    safeString(row.event_key) ||
    safeString((isRecord(row.metadata) ? row.metadata.dedup_key : null) as unknown) ||
    safeString((isRecord(row.meta) ? row.meta.dedup_key : null) as unknown)
  );
}

async function checkAutomationDedupTable(
  db: SupabaseRestClient,
  dedupKey: string,
  sinceIso: string
): Promise<"duplicate" | "missing_or_not_found"> {
  const variants: URLSearchParams[] = [
    new URLSearchParams({
      select: "id,dedup_key,created_at",
      dedup_key: `eq.${dedupKey}`,
      created_at: `gte.${sinceIso}`,
      limit: "1",
    }),
    new URLSearchParams({
      select: "id,key,created_at",
      key: `eq.${dedupKey}`,
      created_at: `gte.${sinceIso}`,
      limit: "1",
    }),
    new URLSearchParams({
      select: "id,event_key,created_at",
      event_key: `eq.${dedupKey}`,
      created_at: `gte.${sinceIso}`,
      limit: "1",
    }),
  ];

  for (const query of variants) {
    const rows = await safeSelectMany(db, "automation_dedup", query);
    if (!rows) continue;
    if (rows.length > 0) return "duplicate";
    return "missing_or_not_found";
  }

  return "missing_or_not_found";
}

async function reserveAutomationDedupTable(
  db: SupabaseRestClient,
  input: CrmAutomationDedupCheckInput
): Promise<"reserved" | "duplicate" | "unavailable"> {
  const nowIso = new Date().toISOString();
  const payloadVariants: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      dedup_key: input.dedupKey,
      event: input.event,
      entity_type: "lead",
      entity_id: input.leadId,
      meta: {
        dedup_key: input.dedupKey,
        scope: input.scopeValue ?? null,
      },
      created_at: nowIso,
    },
    {
      id: randomUUID(),
      key: input.dedupKey,
      event: input.event,
      entity_type: "lead",
      entity_id: input.leadId,
      metadata: {
        dedup_key: input.dedupKey,
        scope: input.scopeValue ?? null,
      },
      created_at: nowIso,
    },
    {
      dedup_key: input.dedupKey,
      event: input.event,
      entity_id: input.leadId,
      metadata: {
        dedup_key: input.dedupKey,
        scope: input.scopeValue ?? null,
      },
    },
  ];

  let sawNonDuplicateFailure = false;
  for (const payload of payloadVariants) {
    const res = await safeInsert(db, "automation_dedup", payload);
    if (res.ok) return "reserved";
    if (res.duplicate) return "duplicate";
    sawNonDuplicateFailure = true;
  }
  return sawNonDuplicateFailure ? "unavailable" : "unavailable";
}

async function checkSystemLogsFallback(
  db: SupabaseRestClient,
  dedupKey: string,
  sinceIso: string
): Promise<boolean> {
  const direct = await safeSelectMany(
    db,
    "system_logs",
    new URLSearchParams({
      select: "id,created_at,metadata,meta",
      event: "eq.crm_auto_dedup",
      "metadata->>dedup_key": `eq.${dedupKey}`,
      created_at: `gte.${sinceIso}`,
      limit: "1",
    })
  );
  if (direct && direct.length > 0) return true;

  const recent = await safeSelectMany(
    db,
    "system_logs",
    new URLSearchParams({
      select: "id,event,created_at,metadata,meta",
      event: "eq.crm_auto_dedup",
      created_at: `gte.${sinceIso}`,
      order: "created_at.desc",
      limit: "300",
    })
  );
  if (!recent) return false;
  return recent.some((row) => readDedupKey(row) === dedupKey);
}

async function writeDedupSystemLog(
  db: SupabaseRestClient,
  input: CrmAutomationDedupCheckInput
): Promise<boolean> {
  const meta = {
    dedup_key: input.dedupKey,
    event: input.event,
    lead_id: input.leadId,
    scope: input.scopeValue ?? null,
  };

  const payloads: Array<Record<string, unknown>> = [
    {
      level: "info",
      event: "crm_auto_dedup",
      entity_type: "lead",
      entity_id: input.leadId,
      message: "CRM automation dedup reservation",
      metadata: meta,
    },
    {
      level: "info",
      event: "crm_auto_dedup",
      entity_type: "lead",
      entity_id: input.leadId,
      message: "CRM automation dedup reservation",
      meta,
    },
    {
      event: "crm_auto_dedup",
      message: "CRM automation dedup reservation",
      meta,
    },
  ];

  for (const payload of payloads) {
    const res = await safeInsert(db, "system_logs", payload);
    if (res.ok) return true;
  }
  return false;
}

export function buildCrmAutomationDedupKey(args: {
  event: string;
  leadId: string;
  scopeValue?: string | null;
}): string {
  const event = safeString(args.event) || "unknown";
  const leadId = safeString(args.leadId) || "unknown";
  const scope = safeString(args.scopeValue) || "na";
  return `crm_auto:${event}:${leadId}:${scope}`;
}

export async function reserveCrmAutomationDedup(
  db: SupabaseRestClient,
  input: CrmAutomationDedupCheckInput
): Promise<CrmAutomationDedupCheckResult> {
  const dedupKey = safeString(input.dedupKey);
  const leadId = safeString(input.leadId);
  const event = safeString(input.event);
  if (!dedupKey || !leadId || !event) {
    return {
      shouldRun: false,
      deduped: true,
      storage: "system_logs",
      reason: "fallback_duplicate",
    };
  }

  const sinceIso = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();

  const tableCheck = await checkAutomationDedupTable(db, dedupKey, sinceIso);
  if (tableCheck === "duplicate") {
    return {
      shouldRun: false,
      deduped: true,
      storage: "automation_dedup",
      reason: "duplicate",
    };
  }

  const tableReserve = await reserveAutomationDedupTable(db, input);
  if (tableReserve === "reserved") {
    return {
      shouldRun: true,
      deduped: false,
      storage: "automation_dedup",
      reason: "reserved",
    };
  }
  if (tableReserve === "duplicate") {
    return {
      shouldRun: false,
      deduped: true,
      storage: "automation_dedup",
      reason: "duplicate",
    };
  }

  const fallbackDuplicate = await checkSystemLogsFallback(db, dedupKey, sinceIso);
  if (fallbackDuplicate) {
    return {
      shouldRun: false,
      deduped: true,
      storage: "system_logs",
      reason: "fallback_duplicate",
    };
  }

  await writeDedupSystemLog(db, input);
  return {
    shouldRun: true,
    deduped: false,
    storage: "system_logs",
    reason: "fallback_reserved",
  };
}
