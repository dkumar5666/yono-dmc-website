import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

interface PaymentAmountRow {
  amount?: number | string | null;
}

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  customer_id?: string | null;
  lifecycle_status?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
}

interface CustomerRow {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface ControlCenterRecentBooking {
  booking_id: string;
  customer_name: string | null;
  status: string | null;
  created_at: string | null;
}

interface ControlCenterResponse {
  revenueToday: number;
  activeBookings: number;
  pendingPayments: number;
  recentBookings: ControlCenterRecentBooking[];
  alerts: string[];
}

const EMPTY_RESPONSE: ControlCenterResponse = {
  revenueToday: 0,
  activeBookings: 0,
  pendingPayments: 0,
  recentBookings: [],
  alerts: [],
};

function startAndEndOfTodayUtc() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
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

async function safeCountByQuery(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<number> {
  const rows = await safeSelectMany<{ id?: string | null }>(db, table, query);
  return rows.length;
}

async function getRevenueToday(db: SupabaseRestClient): Promise<number> {
  const { startIso, endIso } = startAndEndOfTodayUtc();
  const query = new URLSearchParams();
  query.set("select", "amount,status,created_at");
  query.set("status", "in.(paid,captured)");
  query.set("and", `(created_at.gte.${startIso},created_at.lt.${endIso})`);

  const rows = await safeSelectMany<PaymentAmountRow>(db, "payments", query);
  return rows.reduce((sum, row) => {
    const amount = typeof row.amount === "string" ? Number(row.amount) : Number(row.amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

async function getActiveBookings(db: SupabaseRestClient): Promise<number> {
  const statusQuery = new URLSearchParams();
  statusQuery.set("select", "id");
  statusQuery.set("status", "in.(confirmed,traveling)");
  try {
    const statusRows = await db.selectMany<{ id?: string }>("bookings", statusQuery);
    return statusRows.length;
  } catch {
    // fall through to schema-compatible fallback for current booking model
  }

  const fallbackQuery = new URLSearchParams();
  fallbackQuery.set("select", "id");
  fallbackQuery.set("supplier_status", "in.(confirmed,partially_confirmed)");
  return safeCountByQuery(db, "bookings", fallbackQuery);
}

async function getPendingPayments(db: SupabaseRestClient): Promise<number> {
  const query = new URLSearchParams();
  query.set("select", "id");
  query.set("payment_status", "in.(pending,payment_pending)");
  return safeCountByQuery(db, "bookings", query);
}

function formatCustomerName(customer?: CustomerRow): string | null {
  if (!customer) return null;
  const first = customer.first_name?.trim() ?? "";
  const last = customer.last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || customer.email?.trim() || null;
}

async function getRecentBookings(db: SupabaseRestClient): Promise<ControlCenterRecentBooking[]> {
  const bookingQuery = new URLSearchParams();
  bookingQuery.set(
    "select",
    "id,booking_code,customer_id,lifecycle_status,payment_status,created_at"
  );
  bookingQuery.set("order", "created_at.desc");
  bookingQuery.set("limit", "5");

  const rows = await safeSelectMany<BookingRow>(db, "bookings", bookingQuery);
  if (rows.length === 0) return [];

  const customerIds = Array.from(
    new Set(rows.map((row) => row.customer_id).filter((value): value is string => Boolean(value)))
  );

  let customerMap = new Map<string, CustomerRow>();
  if (customerIds.length > 0) {
    const customerQuery = new URLSearchParams();
    customerQuery.set("select", "id,first_name,last_name,email");
    customerQuery.set("id", `in.(${customerIds.join(",")})`);
    const customers = await safeSelectMany<CustomerRow>(db, "customers", customerQuery);
    customerMap = new Map(
      customers
        .filter((c): c is CustomerRow & { id: string } => Boolean(c.id))
        .map((c) => [c.id, c])
    );
  }

  return rows.map((row) => ({
    booking_id: row.booking_code?.trim() || row.id?.trim() || "—",
    customer_name: formatCustomerName(customerMap.get(row.customer_id ?? "")),
    status: row.lifecycle_status?.trim() || row.payment_status?.trim() || null,
    created_at: row.created_at ?? null,
  }));
}

function buildAlerts(metrics: Pick<ControlCenterResponse, "pendingPayments" | "activeBookings">): string[] {
  const alerts: string[] = [];
  if (metrics.pendingPayments > 0) {
    alerts.push("Pending payments require attention");
  }
  if (metrics.activeBookings > 50) {
    alerts.push("High active booking load");
  }
  return alerts;
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const [revenueToday, activeBookings, pendingPayments, recentBookings] = await Promise.all([
      getRevenueToday(db),
      getActiveBookings(db),
      getPendingPayments(db),
      getRecentBookings(db),
    ]);

    const payload: ControlCenterResponse = {
      revenueToday,
      activeBookings,
      pendingPayments,
      recentBookings,
      alerts: buildAlerts({ pendingPayments, activeBookings }),
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    return routeError(500, "Failed to load control center metrics");
  }
}
