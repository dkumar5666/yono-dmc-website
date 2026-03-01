import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type GenericRow = Record<string, unknown>;

interface AutomationFailureListRow {
  id?: string | null;
  booking_id?: string | null;
  event?: string | null;
  status?: string | null;
  attempts?: number | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function parseSinceHours(value: string | null): number {
  const parsed = Number(value ?? 72);
  if (!Number.isFinite(parsed)) return 72;
  return Math.min(24 * 30, Math.max(1, Math.floor(parsed)));
}

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

async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    return await db.selectMany<T>(table, query);
  } catch {
    return [];
  }
}

function normalizeFailureRow(row: GenericRow): AutomationFailureListRow {
  const level = safeString(row.level).toLowerCase();
  const mappedStatus =
    safeString(row.status) ||
    safeString(row.failure_status) ||
    safeString(row.state) ||
    (level === "error" ? "failed" : level === "warn" ? "retrying" : "");

  return {
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_id) || null,
    event:
      safeString(row.event) ||
      safeString(row.event_name) ||
      safeString(row.trigger_event) ||
      safeString(row.action) ||
      null,
    status: mappedStatus || null,
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
  };
}

function createdAtWithinHours(value: string | null | undefined, sinceHours: number): boolean {
  const iso = (value ?? "").trim();
  if (!iso) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() <= sinceHours * 60 * 60 * 1000;
}

function statusMatches(filterValue: string, rowStatus: string): boolean {
  const filter = filterValue.trim().toLowerCase();
  if (!filter || filter === "all") return true;
  const status = rowStatus.trim().toLowerCase();
  if (!status) return false;
  if (filter === "failed") return ["failed", "error"].some((token) => status.includes(token));
  if (filter === "retrying") return ["retrying", "processing", "queued", "retry"].some((t) => status.includes(t));
  if (filter === "resolved") return ["resolved", "succeeded", "success", "processed"].some((t) => status.includes(t));
  return status === filter || status.includes(filter);
}

function isEventLikeLogRow(row: GenericRow): boolean {
  const eventish =
    safeString(row.event) ||
    safeString(row.event_name) ||
    safeString(row.trigger_event) ||
    safeString(row.action);
  const source = safeString(row.source).toLowerCase();
  const moduleName = safeString(row.module).toLowerCase();
  return Boolean(eventish) || source.includes("automation") || moduleName.includes("automation");
}

async function fetchFailureSourceRows(db: SupabaseRestClient): Promise<GenericRow[]> {
  const candidates: Array<{ table: string; queries: URLSearchParams[] }> = [
    {
      table: "automation_failures",
      queries: [
        new URLSearchParams({ select: "*", order: "created_at.desc", limit: "500" }),
      ],
    },
    {
      table: "event_failures",
      queries: [
        new URLSearchParams({ select: "*", order: "created_at.desc", limit: "500" }),
      ],
    },
    {
      table: "system_logs",
      queries: [
        new URLSearchParams({
          select: "*",
          level: "eq.error",
          order: "created_at.desc",
          limit: "500",
        }),
        new URLSearchParams({
          select: "*",
          order: "created_at.desc",
          limit: "500",
        }),
      ],
    },
  ];

  for (const candidate of candidates) {
    for (const query of candidate.queries) {
      const rows = await safeSelectMany<GenericRow>(db, candidate.table, query);
      if (rows.length > 0) {
        if (candidate.table === "system_logs") {
          const filtered = rows.filter(isEventLikeLogRow);
          return filtered.length > 0 ? filtered : [];
        }
        return rows;
      }
    }
  }

  return [];
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);

    const status = safeString(url.searchParams.get("status")).toLowerCase();
    const bookingId = safeString(url.searchParams.get("booking_id"));
    const event = safeString(url.searchParams.get("event")).toLowerCase();
    const q = safeString(url.searchParams.get("q")).toLowerCase();
    const sinceHours = parseSinceHours(url.searchParams.get("since_hours"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const sourceRows = await fetchFailureSourceRows(db);
    if (sourceRows.length === 0) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const normalized = sourceRows
      .map(normalizeFailureRow)
      .filter((row) => {
        const rowBookingId = safeString(row.booking_id);
        const rowEvent = safeString(row.event);
        const rowStatus = safeString(row.status);
        const rowError = safeString(row.last_error);

        if (bookingId && rowBookingId !== bookingId) return false;
        if (event && !rowEvent.toLowerCase().includes(event)) return false;
        if (status && status !== "all" && !statusMatches(status, rowStatus)) return false;
        if (!createdAtWithinHours(row.created_at, sinceHours)) return false;
        if (q) {
          const haystack = [rowError, rowEvent, rowStatus, rowBookingId].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

    const total = normalized.length;
    const rows = normalized.slice(offset, offset + limit);
    return NextResponse.json({ rows, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }
    return routeError(500, "Failed to load automation failures");
  }
}
