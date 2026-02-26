import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type Params = { id: string };

interface PaymentRow {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  currency_code?: string | null;
  status?: string | null;
  provider?: string | null;
  created_at?: string | null;
  raw?: unknown;
  raw_payload?: unknown;
  provider_payment_id?: string | null;
  receipt?: string | null;
  notes?: unknown;
  metadata?: unknown;
}

interface BookingRow {
  id?: string | null;
  booking_id?: string | null;
  booking_code?: string | null;
  status?: string | null;
  lifecycle_status?: string | null;
  payment_status?: string | null;
  total_amount?: number | string | null;
  gross_amount?: number | string | null;
  currency?: string | null;
  currency_code?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  created_at?: string | null;
}

interface CustomerRow {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface RefundRow {
  id?: string | null;
  payment_id?: string | null;
  booking_id?: string | null;
  amount?: number | string | null;
  status?: string | null;
  provider_refund_id?: string | null;
  created_at?: string | null;
  raw?: unknown;
  metadata?: unknown;
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

async function resolvePayment(db: SupabaseRestClient, id: string): Promise<PaymentRow | null> {
  const primary = new URLSearchParams({
    select:
      "id,booking_id,amount,currency,status,provider,created_at,raw,provider_payment_id,receipt,notes",
    id: `eq.${id}`,
  });
  const primaryRow = await safeSelectSingle<PaymentRow>(db, "payments", primary);
  if (primaryRow) return primaryRow;

  const fallback = new URLSearchParams({
    select:
      "id,booking_id,amount,currency_code,status,provider,created_at,raw_payload,provider_payment_id,metadata",
    id: `eq.${id}`,
  });
  return safeSelectSingle<PaymentRow>(db, "payments", fallback);
}

async function resolveLinkedBooking(db: SupabaseRestClient, bookingRef: string): Promise<BookingRow | null> {
  if (!bookingRef) return null;

  const commonSelect =
    "id,booking_code,lifecycle_status,payment_status,gross_amount,currency_code,customer_id,created_at";

  const byId = new URLSearchParams({ select: commonSelect, id: `eq.${bookingRef}` });
  const byIdRow = await safeSelectSingle<BookingRow>(db, "bookings", byId);
  if (byIdRow) return byIdRow;

  const byCode = new URLSearchParams({ select: commonSelect, booking_code: `eq.${bookingRef}` });
  return safeSelectSingle<BookingRow>(db, "bookings", byCode);
}

async function resolveCustomer(
  db: SupabaseRestClient,
  customerId: string | null | undefined
): Promise<CustomerRow | null> {
  if (!customerId) return null;
  return safeSelectSingle<CustomerRow>(
    db,
    "customers",
    new URLSearchParams({
      select: "id,first_name,last_name,email",
      id: `eq.${customerId}`,
    })
  );
}

function formatCustomerName(customer: CustomerRow | null): string | null {
  if (!customer) return null;
  const full = [safeString(customer.first_name), safeString(customer.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || safeString(customer.email) || null;
}

async function resolveRefunds(
  db: SupabaseRestClient,
  paymentId: string,
  bookingId: string | null
): Promise<RefundRow[]> {
  const queries: Array<{ table: string; query: URLSearchParams }> = [];

  const paymentRefundsByPayment = new URLSearchParams({
    select: "id,payment_id,booking_id,amount,status,provider_refund_id,created_at,metadata",
    payment_id: `eq.${paymentId}`,
    order: "created_at.desc",
    limit: "20",
  });
  queries.push({ table: "payment_refunds", query: paymentRefundsByPayment });

  if (bookingId) {
    const paymentRefundsByBooking = new URLSearchParams({
      select: "id,payment_id,booking_id,amount,status,provider_refund_id,created_at,metadata",
      booking_id: `eq.${bookingId}`,
      order: "created_at.desc",
      limit: "20",
    });
    queries.push({ table: "payment_refunds", query: paymentRefundsByBooking });
  }

  const legacyRefundsByPayment = new URLSearchParams({
    select: "id,payment_id,booking_id,amount,status,provider_refund_id,created_at,raw",
    payment_id: `eq.${paymentId}`,
    order: "created_at.desc",
    limit: "20",
  });
  queries.push({ table: "refunds", query: legacyRefundsByPayment });

  if (bookingId) {
    const legacyRefundsByBooking = new URLSearchParams({
      select: "id,payment_id,booking_id,amount,status,provider_refund_id,created_at,raw",
      booking_id: `eq.${bookingId}`,
      order: "created_at.desc",
      limit: "20",
    });
    queries.push({ table: "refunds", query: legacyRefundsByBooking });
  }

  for (const entry of queries) {
    const rows = await safeSelectMany<RefundRow>(db, entry.table, entry.query);
    if (rows.length > 0) return rows.slice(0, 20);
  }
  return [];
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
      return NextResponse.json({ payment: null, booking: null, refunds: [] });
    }

    const db = new SupabaseRestClient();
    const paymentRow = await resolvePayment(db, id);
    if (!paymentRow) {
      return NextResponse.json({ payment: null, booking: null, refunds: [] });
    }

    const payment = {
      id: paymentRow.id ?? null,
      booking_id: paymentRow.booking_id ?? null,
      amount: toNumber(paymentRow.amount),
      currency: safeString(paymentRow.currency) || safeString(paymentRow.currency_code) || null,
      status: safeString(paymentRow.status) || null,
      provider: safeString(paymentRow.provider) || null,
      created_at: paymentRow.created_at ?? null,
      raw: paymentRow.raw ?? paymentRow.raw_payload ?? null,
      provider_payment_id: safeString(paymentRow.provider_payment_id) || null,
      receipt: safeString(paymentRow.receipt) || null,
      notes: paymentRow.notes ?? paymentRow.metadata ?? null,
    };

    let booking: {
      booking_id?: string | null;
      status?: string | null;
      payment_status?: string | null;
      total_amount?: number | null;
      currency?: string | null;
      customer_name?: string | null;
      customer_email?: string | null;
      created_at?: string | null;
    } | null = null;

    if (payment.booking_id) {
      const bookingRow = await resolveLinkedBooking(db, payment.booking_id);
      if (bookingRow) {
        let customerName = safeString(bookingRow.customer_name) || null;
        let customerEmail = safeString(bookingRow.customer_email) || null;

        if ((!customerName || !customerEmail) && bookingRow.customer_id) {
          const customer = await resolveCustomer(db, bookingRow.customer_id);
          customerName = customerName || formatCustomerName(customer);
          customerEmail = customerEmail || safeString(customer?.email) || null;
        }

        booking = {
          booking_id: safeString(bookingRow.booking_id) || safeString(bookingRow.booking_code) || safeString(bookingRow.id) || null,
          status: safeString(bookingRow.status) || safeString(bookingRow.lifecycle_status) || null,
          payment_status: safeString(bookingRow.payment_status) || null,
          total_amount: toNumber(bookingRow.total_amount) ?? toNumber(bookingRow.gross_amount),
          currency: safeString(bookingRow.currency) || safeString(bookingRow.currency_code) || null,
          customer_name: customerName,
          customer_email: customerEmail,
          created_at: bookingRow.created_at ?? null,
        };
      }
    }

    const refundRows = await resolveRefunds(db, id, payment.booking_id ?? null);
    const refunds = refundRows.map((row) => ({
      id: row.id ?? null,
      payment_id: row.payment_id ?? null,
      booking_id: row.booking_id ?? null,
      amount: toNumber(row.amount),
      status: safeString(row.status) || null,
      provider_refund_id: safeString(row.provider_refund_id) || null,
      created_at: row.created_at ?? null,
      raw: row.raw ?? row.metadata ?? null,
    }));

    return NextResponse.json({ payment, booking, refunds });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ payment: null, booking: null, refunds: [] });
    }
    return routeError(500, "Failed to load payment details");
  }
}
