import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type Params = { id: string };

interface RefundRow {
  id?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  currency_code?: string | null;
  status?: string | null;
  provider_refund_id?: string | null;
  provider?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  raw?: unknown;
  raw_payload?: unknown;
  notes?: unknown;
  reason?: string | null;
  metadata?: unknown;
}

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

interface TimelineRow {
  id?: string | null;
  event?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string | null;
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

async function resolveRefund(db: SupabaseRestClient, id: string): Promise<RefundRow | null> {
  const attempts: Array<{ table: string; select: string }> = [
    {
      table: "refunds",
      select:
        "id,booking_id,payment_id,amount,currency,status,provider_refund_id,provider,created_at,updated_at,raw,notes",
    },
    {
      table: "refunds",
      select: "id,booking_id,payment_id,amount,status,provider_refund_id,created_at,raw",
    },
    {
      table: "payment_refunds",
      select:
        "id,booking_id,payment_id,amount,currency_code,status,provider_refund_id,created_at,updated_at,reason,metadata",
    },
    {
      table: "payment_refunds",
      select: "id,booking_id,payment_id,amount,status,provider_refund_id,created_at,metadata",
    },
  ];

  for (const attempt of attempts) {
    const row = await safeSelectSingle<RefundRow>(
      db,
      attempt.table,
      new URLSearchParams({
        select: attempt.select,
        id: `eq.${id}`,
      })
    );
    if (row) return row;
  }

  return null;
}

async function resolvePayment(db: SupabaseRestClient, paymentId: string): Promise<PaymentRow | null> {
  if (!paymentId) return null;
  const primary = await safeSelectSingle<PaymentRow>(
    db,
    "payments",
    new URLSearchParams({
      select: "id,booking_id,amount,currency,status,provider,created_at,raw,notes",
      id: `eq.${paymentId}`,
    })
  );
  if (primary) return primary;

  return safeSelectSingle<PaymentRow>(
    db,
    "payments",
    new URLSearchParams({
      select: "id,booking_id,amount,currency_code,status,provider,created_at,raw_payload,metadata",
      id: `eq.${paymentId}`,
    })
  );
}

async function resolveBooking(db: SupabaseRestClient, bookingRef: string): Promise<BookingRow | null> {
  if (!bookingRef) return null;

  const richSelect =
    "id,booking_id,booking_code,status,lifecycle_status,payment_status,total_amount,gross_amount,currency,currency_code,customer_id,customer_name,customer_email,created_at";
  const fallbackSelect =
    "id,booking_code,lifecycle_status,payment_status,gross_amount,currency_code,customer_id,created_at";

  const byBookingIdRich = await safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({ select: richSelect, booking_id: `eq.${bookingRef}` })
  );
  if (byBookingIdRich) return byBookingIdRich;

  const byIdRich = await safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({ select: richSelect, id: `eq.${bookingRef}` })
  );
  if (byIdRich) return byIdRich;

  const byCodeRich = await safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({ select: richSelect, booking_code: `eq.${bookingRef}` })
  );
  if (byCodeRich) return byCodeRich;

  const byIdFallback = await safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({ select: fallbackSelect, id: `eq.${bookingRef}` })
  );
  if (byIdFallback) return byIdFallback;

  return safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({ select: fallbackSelect, booking_code: `eq.${bookingRef}` })
  );
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

async function resolveTimeline(
  db: SupabaseRestClient,
  refundId: string,
  paymentId: string | null,
  bookingId: string | null
): Promise<TimelineRow[]> {
  const candidates: Array<{ table: string; query: URLSearchParams }> = [];

  candidates.push({
    table: "refund_events",
    query: new URLSearchParams({
      select: "id,event,status,message,created_at",
      refund_id: `eq.${refundId}`,
      order: "created_at.desc",
      limit: "50",
    }),
  });

  candidates.push({
    table: "system_logs",
    query: new URLSearchParams({
      select: "id,event,status,message,created_at",
      refund_id: `eq.${refundId}`,
      order: "created_at.desc",
      limit: "50",
    }),
  });

  if (paymentId) {
    candidates.push({
      table: "system_logs",
      query: new URLSearchParams({
        select: "id,event,status,message,created_at",
        payment_id: `eq.${paymentId}`,
        order: "created_at.desc",
        limit: "50",
      }),
    });
  }

  if (bookingId) {
    candidates.push({
      table: "system_logs",
      query: new URLSearchParams({
        select: "id,event,status,message,created_at",
        booking_id: `eq.${bookingId}`,
        order: "created_at.desc",
        limit: "50",
      }),
    });
  }

  for (const candidate of candidates) {
    const rows = await safeSelectMany<TimelineRow>(db, candidate.table, candidate.query);
    if (rows.length > 0) return rows.slice(0, 50);
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
      return NextResponse.json({ refund: null, payment: null, booking: null, timeline: [] });
    }

    const db = new SupabaseRestClient();
    const refundRow = await resolveRefund(db, id);
    if (!refundRow) {
      return NextResponse.json({ refund: null, payment: null, booking: null, timeline: [] });
    }

    const refund = {
      id: refundRow.id ?? null,
      booking_id: refundRow.booking_id ?? null,
      payment_id: refundRow.payment_id ?? null,
      amount: toNumber(refundRow.amount),
      currency: safeString(refundRow.currency) || safeString(refundRow.currency_code) || null,
      status: safeString(refundRow.status) || null,
      provider_refund_id: safeString(refundRow.provider_refund_id) || null,
      provider: safeString(refundRow.provider) || null,
      created_at: refundRow.created_at ?? null,
      updated_at: refundRow.updated_at ?? null,
      raw: refundRow.raw ?? refundRow.raw_payload ?? refundRow.metadata ?? null,
      notes: refundRow.notes ?? refundRow.reason ?? null,
    };

    const paymentRow = refund.payment_id ? await resolvePayment(db, refund.payment_id) : null;
    const payment = paymentRow
      ? {
          id: paymentRow.id ?? null,
          booking_id: paymentRow.booking_id ?? null,
          amount: toNumber(paymentRow.amount),
          currency: safeString(paymentRow.currency) || safeString(paymentRow.currency_code) || null,
          status: safeString(paymentRow.status) || null,
          provider: safeString(paymentRow.provider) || null,
          created_at: paymentRow.created_at ?? null,
          raw: paymentRow.raw ?? paymentRow.raw_payload ?? paymentRow.metadata ?? null,
        }
      : null;

    const bookingRef = refund.booking_id ?? payment?.booking_id ?? null;
    const bookingRow = bookingRef ? await resolveBooking(db, bookingRef) : null;

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

    if (bookingRow) {
      let customerName = safeString(bookingRow.customer_name) || null;
      let customerEmail = safeString(bookingRow.customer_email) || null;

      if ((!customerName || !customerEmail) && bookingRow.customer_id) {
        const customer = await resolveCustomer(db, bookingRow.customer_id);
        customerName = customerName || formatCustomerName(customer);
        customerEmail = customerEmail || safeString(customer?.email) || null;
      }

      booking = {
        booking_id:
          safeString(bookingRow.booking_id) ||
          safeString(bookingRow.booking_code) ||
          safeString(bookingRow.id) ||
          null,
        status: safeString(bookingRow.status) || safeString(bookingRow.lifecycle_status) || null,
        payment_status: safeString(bookingRow.payment_status) || null,
        total_amount: toNumber(bookingRow.total_amount) ?? toNumber(bookingRow.gross_amount),
        currency: safeString(bookingRow.currency) || safeString(bookingRow.currency_code) || null,
        customer_name: customerName,
        customer_email: customerEmail,
        created_at: bookingRow.created_at ?? null,
      };
    }

    let timeline = await resolveTimeline(db, id, refund.payment_id ?? null, refund.booking_id ?? payment?.booking_id ?? null);
    if (timeline.length === 0) {
      timeline = [
        {
          id: `refund-${refund.id ?? id}`,
          event: "refund_recorded",
          status: refund.status ?? null,
          message: refund.provider_refund_id
            ? `Refund recorded with provider reference ${refund.provider_refund_id}`
            : "Refund record available",
          created_at: refund.created_at ?? null,
        },
      ].filter((entry) => Boolean(entry.created_at || entry.message));
    }

    return NextResponse.json({
      refund,
      payment,
      booking,
      timeline: timeline.map((row) => ({
        id: row.id ?? null,
        event: safeString(row.event) || null,
        status: safeString(row.status) || null,
        message: safeString(row.message) || null,
        created_at: row.created_at ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ refund: null, payment: null, booking: null, timeline: [] });
    }
    return routeError(500, "Failed to load refund details");
  }
}

