import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type GenericRow = Record<string, unknown>;

interface AdminSupplierLogRow {
  id?: string | null;
  booking_id?: string | null;
  supplier?: string | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string | null;
  duration_ms?: number | null;
  request_id?: string | null;
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

function normalizeSupplierLogRow(row: GenericRow): AdminSupplierLogRow {
  return {
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_id) || null,
    supplier:
      safeString(row.supplier) ||
      safeString(row.supplier_name) ||
      safeString(row.provider) ||
      safeString(row.supplier_code) ||
      safeString(row.supplier_id) ||
      null,
    action:
      safeString(row.action) ||
      safeString(row.operation) ||
      safeString(row.event_name) ||
      safeString(row.event) ||
      null,
    status: safeString(row.status) || safeString(row.result) || safeString(row.level) || null,
    message:
      safeString(row.message) ||
      safeString(row.error_message) ||
      safeString(row.note) ||
      safeString(row.reason) ||
      null,
    created_at: safeString(row.created_at) || null,
    duration_ms: toNumber(row.duration_ms) ?? toNumber(row.latency_ms) ?? null,
    request_id:
      safeString(row.request_id) || safeString(row.correlation_id) || safeString(row.trace_id) || null,
  };
}

function statusMatches(filterValue: string, statusValue: string): boolean {
  const filter = filterValue.trim().toLowerCase();
  if (!filter || filter === "all") return true;
  const status = statusValue.trim().toLowerCase();
  if (!status) return false;

  if (filter === "failed" || filter === "fail") {
    return ["failed", "fail", "error"].some((token) => status.includes(token));
  }
  if (filter === "success" || filter === "succeeded") {
    return ["success", "succeeded", "processed", "ok"].some((token) => status.includes(token));
  }
  if (filter === "pending") {
    return ["pending", "queued", "processing"].some((token) => status.includes(token));
  }
  return status === filter || status.includes(filter);
}

async function resolveSourceRows(db: SupabaseRestClient): Promise<GenericRow[]> {
  const candidates: Array<{ table: string; selects: string[] }> = [
    {
      table: "supplier_logs",
      selects: [
        "id,booking_id,supplier,action,status,message,created_at,duration_ms,request_id",
        "*",
      ],
    },
    {
      table: "supplier_api_logs",
      selects: [
        "id,booking_id,provider,operation,status,message,created_at,duration_ms,request_id",
        "*",
      ],
    },
  ];

  for (const candidate of candidates) {
    for (const select of candidate.selects) {
      const rows = await safeSelectMany<GenericRow>(
        db,
        candidate.table,
        new URLSearchParams({
          select,
          order: "created_at.desc",
        })
      );
      if (rows.length > 0) return rows;
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

    const bookingIdFilter = safeString(url.searchParams.get("booking_id"));
    const supplierFilter = safeString(url.searchParams.get("supplier")).toLowerCase();
    const actionFilter = safeString(url.searchParams.get("action")).toLowerCase();
    const statusFilter = safeString(url.searchParams.get("status")).toLowerCase();
    const q = safeString(url.searchParams.get("q")).toLowerCase();
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const sourceRows = await resolveSourceRows(db);
    if (sourceRows.length === 0) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const normalizedRows = sourceRows.map(normalizeSupplierLogRow);
    const filteredRows = normalizedRows.filter((row) => {
      const bookingId = safeString(row.booking_id);
      const supplier = safeString(row.supplier);
      const action = safeString(row.action);
      const status = safeString(row.status);
      const message = safeString(row.message);

      if (bookingIdFilter && bookingId !== bookingIdFilter) return false;
      if (supplierFilter && !supplier.toLowerCase().includes(supplierFilter)) return false;
      if (actionFilter && action.toLowerCase() !== actionFilter) return false;
      if (statusFilter && !statusMatches(statusFilter, status)) return false;
      if (q) {
        const haystack = [bookingId, supplier, action, status, message].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const total = filteredRows.length;
    const rows = filteredRows.slice(offset, offset + limit);
    return NextResponse.json({ rows, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }
    return routeError(500, "Failed to load supplier logs");
  }
}

