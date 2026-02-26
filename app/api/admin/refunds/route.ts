import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

interface RefundRowRaw {
  id?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  currency_code?: string | null;
  status?: string | null;
  provider_refund_id?: string | null;
  created_at?: string | null;
}

interface AdminRefundListRow {
  id?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  provider_refund_id?: string | null;
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

function safeString(value: string | null | undefined): string {
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

function applyStatusFilter(query: URLSearchParams, rawStatus: string) {
  const status = rawStatus.trim().toLowerCase();
  if (!status || status === "all") return;
  if (status === "succeeded") {
    query.set("status", "in.(succeeded,processed)");
    return;
  }
  query.set("status", `eq.${status}`);
}

async function selectRefundsRows(db: SupabaseRestClient, query: URLSearchParams): Promise<RefundRowRaw[]> {
  try {
    return await db.selectMany<RefundRowRaw>(dbTableForRefundsPrimary, query);
  } catch {
    // fallback to schema-native payment_refunds table
  }

  const fallback = new URLSearchParams(query.toString());
  if (fallback.get("select") ===
    "id,booking_id,payment_id,amount,currency,status,provider_refund_id,created_at") {
    fallback.set("select", "id,booking_id,payment_id,amount,currency_code,status,provider_refund_id,created_at");
  }
  try {
    return await db.selectMany<RefundRowRaw>("payment_refunds", fallback);
  } catch {
    return [];
  }
}

const dbTableForRefundsPrimary = "refunds";

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);
    const status = safeString(url.searchParams.get("status"));
    const bookingIdFilter = safeString(url.searchParams.get("booking_id"));
    const paymentIdFilter = safeString(url.searchParams.get("payment_id"));
    const day = safeString(url.searchParams.get("day")).toLowerCase();
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const query = new URLSearchParams();
    query.set("select", "id,booking_id,payment_id,amount,currency,status,provider_refund_id,created_at");
    query.set("order", "created_at.desc");
    applyStatusFilter(query, status);

    if (bookingIdFilter) {
      query.set("booking_id", `eq.${bookingIdFilter}`);
    }
    if (paymentIdFilter) {
      query.set("payment_id", `eq.${paymentIdFilter}`);
    }
    if (day === "today") {
      const dayWindow = getISTDayWindowUtc();
      query.set("and", `(created_at.gte.${dayWindow.startUtc},created_at.lte.${dayWindow.endUtc})`);
    }

    const rowsRaw = await selectRefundsRows(db, query);
    const mapped: AdminRefundListRow[] = rowsRaw.map((row) => ({
      id: row.id ?? null,
      booking_id: row.booking_id ?? null,
      payment_id: row.payment_id ?? null,
      amount: toNumber(row.amount),
      currency: safeString(row.currency) || safeString(row.currency_code) || null,
      status: safeString(row.status) || null,
      provider_refund_id: safeString(row.provider_refund_id) || null,
      created_at: row.created_at ?? null,
    }));

    const total = mapped.length;
    const rows = mapped.slice(offset, offset + limit);
    return NextResponse.json({ rows, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }
    return routeError(500, "Failed to load admin refunds");
  }
}

