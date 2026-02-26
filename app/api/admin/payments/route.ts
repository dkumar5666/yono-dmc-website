import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

interface PaymentRow {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | string | null;
  status?: string | null;
  created_at?: string | null;
}

interface AdminPaymentListRow {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
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

function safeString(value: string | null): string {
  return (value ?? "").trim();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getISTDayWindowUtc(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const offsetMinutes = 330;

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { startUtc: start.toISOString(), endUtc: end.toISOString() };
  }

  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60_000;
  const endUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMinutes * 60_000;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
  };
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

function applyStatusFilter(query: URLSearchParams, rawStatus: string) {
  const status = rawStatus.trim().toLowerCase();
  if (!status || status === "all") return;

  if (status === "paid") {
    query.set("status", "in.(paid,captured)");
    return;
  }

  if (status === "pending") {
    query.set("status", "in.(pending,created,requires_action,authorized)");
    return;
  }

  query.set("status", `eq.${status}`);
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);
    const status = safeString(url.searchParams.get("status"));
    const bookingIdFilter = safeString(url.searchParams.get("booking_id")).toLowerCase();
    const day = safeString(url.searchParams.get("day")).toLowerCase();
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const paymentsQuery = new URLSearchParams();
    paymentsQuery.set("select", "id,booking_id,amount,status,created_at");
    paymentsQuery.set("order", "created_at.desc");
    applyStatusFilter(paymentsQuery, status);

    if (day === "today") {
      const dayWindow = getISTDayWindowUtc();
      paymentsQuery.set("and", `(created_at.gte.${dayWindow.startUtc},created_at.lte.${dayWindow.endUtc})`);
    }

    const payments = await safeSelectMany<PaymentRow>(db, "payments", paymentsQuery);

    const mappedRows: AdminPaymentListRow[] = payments.map((row) => ({
      id: row.id ?? null,
      booking_id: row.booking_id ?? null,
      amount: toNumber(row.amount),
      status: safeString(row.status ?? null) || null,
      created_at: row.created_at ?? null,
    }));

    const filteredRows =
      bookingIdFilter.length > 0
        ? mappedRows.filter((row) =>
            safeString(row.booking_id ?? null).toLowerCase().includes(bookingIdFilter)
          )
        : mappedRows;

    const total = filteredRows.length;
    const rows = filteredRows.slice(offset, offset + limit);

    return NextResponse.json({ rows, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    return routeError(500, "Failed to load admin payments");
  }
}

