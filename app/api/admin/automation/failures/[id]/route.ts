import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type Params = { id: string };
type GenericRow = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function safeSelectSingle<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T | null> {
  try {
    return await db.selectSingle<T>(table, query);
  } catch {
    return null;
  }
}

function normalizeFailure(row: GenericRow | null) {
  if (!row) return null;
  const level = safeString(row.level).toLowerCase();
  return {
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_id) || null,
    event:
      safeString(row.event) ||
      safeString(row.event_name) ||
      safeString(row.trigger_event) ||
      safeString(row.action) ||
      null,
    status:
      safeString(row.status) ||
      safeString(row.failure_status) ||
      safeString(row.state) ||
      (level === "error" ? "failed" : level || null),
    attempts:
      toNumber(row.attempts) ??
      toNumber(row.retry_count) ??
      toNumber(row.retries) ??
      toNumber(row.attempt_count) ??
      null,
    last_error:
      safeString(row.last_error) ||
      safeString(row.error) ||
      safeString(row.message) ||
      safeString(row.reason) ||
      null,
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
    payload:
      row.payload ??
      row.context ??
      row.raw_payload ??
      row.request_payload ??
      row.response_payload ??
      null,
    meta:
      row.meta ??
      row.metadata ??
      null,
    stack:
      safeString(row.stack) ||
      safeString(row.trace) ||
      null,
  };
}

async function resolveFailure(db: SupabaseRestClient, id: string): Promise<GenericRow | null> {
  const candidates: Array<{ table: string; selects: string[] }> = [
    {
      table: "event_failures",
      selects: [
        "id,booking_id,event,status,attempts,last_error,created_at,updated_at,payload,meta,stack",
        "*",
      ],
    },
    {
      table: "automation_failures",
      selects: [
        "id,booking_id,event,status,attempts,last_error,created_at,updated_at,payload,meta,stack",
        "*",
      ],
    },
    {
      table: "system_logs",
      selects: [
        "id,booking_id,event,event_name,level,message,error,created_at,updated_at,payload,context,meta,stack",
        "*",
      ],
    },
  ];

  for (const candidate of candidates) {
    for (const select of candidate.selects) {
      const row = await safeSelectSingle<GenericRow>(
        db,
        candidate.table,
        new URLSearchParams({
          select,
          id: `eq.${id}`,
        })
      );
      if (row) return row;
    }
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in params ? await params : params;
    const id = decodeURIComponent(resolved.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ failure: null });
    }

    const db = new SupabaseRestClient();
    const row = await resolveFailure(db, id);
    return NextResponse.json({ failure: normalizeFailure(row) });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ failure: null });
    }
    return routeError(500, "Failed to load automation failure details");
  }
}

