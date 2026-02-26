import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  customer_id?: string | null;
  lifecycle_status?: string | null;
  supplier_status?: string | null;
  payment_status?: string | null;
  gross_amount?: number | string | null;
  created_at?: string | null;
}

interface CustomerRow {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface AdminBookingListRow {
  booking_id: string;
  customer_name?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
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

function formatCustomerName(customer?: CustomerRow): string | null {
  if (!customer) return null;
  const first = safeString(customer.first_name ?? null);
  const last = safeString(customer.last_name ?? null);
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || safeString(customer.email ?? null) || null;
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

  if (status === "active" || status === "confirmed") {
    query.set("supplier_status", "in.(confirmed,partially_confirmed)");
    return;
  }

  if (status === "traveling") {
    query.set("lifecycle_status", "in.(supplier_confirmed,documents_generated)");
    return;
  }

  query.set("lifecycle_status", `eq.${status}`);
}

function applyPaymentStatusFilter(query: URLSearchParams, rawPaymentStatus: string) {
  const paymentStatus = rawPaymentStatus.trim().toLowerCase();
  if (!paymentStatus || paymentStatus === "all") return;

  if (paymentStatus === "pending") {
    query.set("payment_status", "in.(pending,payment_pending)");
    return;
  }

  if (paymentStatus === "captured") {
    query.set("payment_status", "in.(captured,paid)");
    return;
  }

  if (paymentStatus === "paid") {
    query.set("payment_status", "eq.paid");
    return;
  }

  query.set("payment_status", `eq.${paymentStatus}`);
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);
    const status = safeString(url.searchParams.get("status"));
    const paymentStatus = safeString(url.searchParams.get("payment_status"));
    const q = safeString(url.searchParams.get("q")).toLowerCase();
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const bookingsQuery = new URLSearchParams();
    bookingsQuery.set(
      "select",
      "id,booking_code,customer_id,lifecycle_status,supplier_status,payment_status,gross_amount,created_at"
    );
    bookingsQuery.set("order", "created_at.desc");
    applyStatusFilter(bookingsQuery, status);
    applyPaymentStatusFilter(bookingsQuery, paymentStatus);

    const bookings = await safeSelectMany<BookingRow>(db, "bookings", bookingsQuery);
    if (bookings.length === 0) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const customerIds = Array.from(
      new Set(bookings.map((row) => row.customer_id).filter((value): value is string => Boolean(value)))
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

    const mappedRows: AdminBookingListRow[] = bookings.map((row) => {
      const bookingId = safeString(row.booking_code ?? null) || safeString(row.id ?? null) || "-";
      const customerName = formatCustomerName(customerMap.get(row.customer_id ?? ""));
      return {
        booking_id: bookingId,
        customer_name: customerName,
        status:
          safeString(row.lifecycle_status ?? null) || safeString(row.supplier_status ?? null) || null,
        payment_status: safeString(row.payment_status ?? null) || null,
        total_amount: toNumber(row.gross_amount),
        created_at: row.created_at ?? null,
      };
    });

    const filteredRows =
      q.length > 0
        ? mappedRows.filter((row) => {
            const bookingId = safeString(row.booking_id).toLowerCase();
            const customerName = safeString(row.customer_name ?? null).toLowerCase();
            return bookingId.includes(q) || customerName.includes(q);
          })
        : mappedRows;

    const total = filteredRows.length;
    const rows = filteredRows.slice(offset, offset + limit);

    return NextResponse.json({ rows, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    return routeError(500, "Failed to load admin bookings");
  }
}

