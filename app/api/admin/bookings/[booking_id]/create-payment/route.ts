import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { createPaymentIntent } from "@/lib/services/payment.service";
import { createRazorpayPaymentLink } from "@/lib/payments/razorpay";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { triggerCrmAutomationBestEffort } from "@/lib/crm/automationDispatch";
import { recordAnalyticsEvent } from "@/lib/system/opsTelemetry";

type Params = { booking_id: string };

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  lead_id?: string | null;
  quotation_id?: string | null;
  customer_id?: string | null;
  lifecycle_status?: string | null;
  payment_status?: string | null;
  gross_amount?: number | string | null;
  due_amount?: number | string | null;
  currency_code?: string | null;
  metadata?: unknown;
}

interface QuotationRow {
  id?: string | null;
  total_amount?: number | string | null;
  currency_code?: string | null;
}

interface CustomerRow {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface PaymentRow {
  id?: string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  status?: string | null;
  provider_order_id?: string | null;
  created_at?: string | null;
  raw_payload?: unknown;
  idempotency_key?: string | null;
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

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const username = auth.claims?.username;
  if (typeof username === "string" && username.trim()) return username.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
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
    const rows = await db.selectMany<T>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function resolveBooking(db: SupabaseRestClient, bookingRef: string): Promise<BookingRow | null> {
  const select =
    "id,booking_code,lead_id,quotation_id,customer_id,lifecycle_status,payment_status,gross_amount,due_amount,currency_code,metadata";

  const byCode = await safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({
      select,
      booking_code: `eq.${bookingRef}`,
    })
  );
  if (byCode) return byCode;

  if (isUuidLike(bookingRef)) {
    return safeSelectSingle<BookingRow>(
      db,
      "bookings",
      new URLSearchParams({
        select,
        id: `eq.${bookingRef}`,
      })
    );
  }
  return null;
}

function isRecentActivePayment(row: PaymentRow): boolean {
  const status = safeString(row.status).toLowerCase();
  const allowed = new Set(["created", "requires_action", "authorized"]);
  if (!allowed.has(status)) return false;
  const createdAt = new Date(safeString(row.created_at)).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt <= 24 * 60 * 60 * 1000;
}

function extractPaymentUrl(row: PaymentRow): string | null {
  const payload = safeObject(row.raw_payload);
  if (!payload) return null;
  return (
    safeString(payload.payment_url) ||
    safeString(payload.payment_link_url) ||
    safeString(payload.short_url) ||
    null
  );
}

function duplicateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("23505") || message.includes("duplicate key") || message.includes("unique");
}

function toTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function createWindowKey(now = Date.now()): string {
  return String(Math.floor(now / (24 * 60 * 60 * 1000)));
}

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const bookingRef = decodeURIComponent(resolved.booking_id ?? "").trim();
    if (!bookingRef) {
      return routeError(404, "Booking not found");
    }

    const booking = await resolveBooking(db, bookingRef);
    if (!booking || !safeString(booking.id)) {
      return routeError(404, "Booking not found");
    }

    const bookingId = safeString(booking.id);
    const bookingCode = safeString(booking.booking_code) || bookingId;
    const body = (await req.json().catch(() => ({}))) as {
      amount?: number;
      currency?: string;
      notes?: Record<string, unknown>;
    };

    const recentPayments = await safeSelectMany<PaymentRow>(
      db,
      "payments",
      new URLSearchParams({
        select: "id,amount,currency_code,status,provider_order_id,created_at,raw_payload,idempotency_key",
        booking_id: `eq.${bookingId}`,
        order: "created_at.desc",
        limit: "50",
      })
    );
    const existing = recentPayments.find((row) => isRecentActivePayment(row));
    if (existing && safeString(existing.id)) {
      return NextResponse.json({
        ok: true,
        booking_id: bookingCode,
        payment_id: safeString(existing.id),
        razorpay_order_id: safeString(existing.provider_order_id) || null,
        payment_url: extractPaymentUrl(existing),
        deduped: true,
      });
    }

    const quoteAmount =
      safeString(booking.quotation_id)
        ? await safeSelectSingle<QuotationRow>(
            db,
            "quotations",
            new URLSearchParams({
              select: "id,total_amount,currency_code",
              id: `eq.${safeString(booking.quotation_id)}`,
            })
          )
        : null;

    const computedAmount =
      toNumber(body.amount) ??
      toNumber(quoteAmount?.total_amount) ??
      toNumber(booking.due_amount) ??
      toNumber(booking.gross_amount) ??
      0;
    const amount = toTwoDecimals(computedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Unable to determine valid payment amount for booking." },
        { status: 400 }
      );
    }

    const currency =
      safeString(body.currency).toUpperCase() ||
      safeString(quoteAmount?.currency_code).toUpperCase() ||
      safeString(booking.currency_code).toUpperCase() ||
      "INR";

    const idempotencyKey = `admin_create_payment:${bookingId}:${currency}:${Math.round(amount * 100)}:${createWindowKey()}`;

    let paymentIntent = null as Awaited<ReturnType<typeof createPaymentIntent>> | null;
    try {
      paymentIntent = await createPaymentIntent({
        bookingId,
        amount,
        currencyCode: currency,
        provider: "razorpay",
        idempotencyKey,
        customerId: safeString(booking.customer_id) || undefined,
      });
    } catch (error) {
      if (!duplicateError(error)) throw error;
      const dedupedPayment = await safeSelectSingle<PaymentRow>(
        db,
        "payments",
        new URLSearchParams({
          select: "id,amount,currency_code,status,provider_order_id,created_at,raw_payload,idempotency_key",
          idempotency_key: `eq.${idempotencyKey}`,
        })
      );
      if (!dedupedPayment || !safeString(dedupedPayment.id)) {
        throw error;
      }
      return NextResponse.json({
        ok: true,
        booking_id: bookingCode,
        payment_id: safeString(dedupedPayment.id),
        razorpay_order_id: safeString(dedupedPayment.provider_order_id) || null,
        payment_url: extractPaymentUrl(dedupedPayment),
        deduped: true,
      });
    }

    if (!paymentIntent?.payment?.id) {
      return routeError(500, "Failed to create payment intent");
    }

    const customer = safeString(booking.customer_id)
      ? await safeSelectSingle<CustomerRow>(
          db,
          "customers",
          new URLSearchParams({
            select: "first_name,last_name,email,phone",
            id: `eq.${safeString(booking.customer_id)}`,
          })
        )
      : null;

    const fullName = [safeString(customer?.first_name), safeString(customer?.last_name)]
      .filter(Boolean)
      .join(" ")
      .trim();

    const paymentLink = await createRazorpayPaymentLink({
      amount,
      currency,
      referenceId: bookingCode,
      description: `Payment for booking ${bookingCode}`,
      customer: {
        name: fullName || null,
        email: safeString(customer?.email) || null,
        phone: safeString(customer?.phone) || null,
      },
      notes: {
        bookingId,
        booking_code: bookingCode,
        lead_id: safeString(booking.lead_id) || null,
        ...(body.notes && typeof body.notes === "object" ? body.notes : {}),
      },
    });

    const existingRawPayload = safeObject(paymentIntent.payment.raw_payload) ?? {};
    const nextRawPayload: Record<string, unknown> = {
      ...existingRawPayload,
      booking_code: bookingCode,
      payment_link_id: paymentLink.id ?? null,
      payment_link_url: paymentLink.shortUrl ?? null,
      payment_link_status: paymentLink.ok ? "created" : "failed",
      payment_link_error: paymentLink.ok ? null : paymentLink.error ?? "payment_link_failed",
    };

    try {
      await db.updateSingle(
        "payments",
        new URLSearchParams({
          id: `eq.${paymentIntent.payment.id}`,
        }),
        {
          provider_order_id:
            safeString(paymentLink.id) || safeString(paymentIntent.payment.provider_order_id) || null,
          raw_payload: nextRawPayload,
          updated_at: new Date().toISOString(),
        }
      );
    } catch {
      // Safe fallback: continue with intent details.
    }

    try {
      await writeAdminAuditLog(db, {
        adminId: auth.userId,
        action: "create_payment_link",
        entityType: "booking",
        entityId: bookingCode,
        message: "Payment link created for booking",
        meta: {
          payment_id: paymentIntent.payment.id,
          amount,
          currency,
          payment_link_id: paymentLink.id ?? null,
          payment_link_status: paymentLink.ok ? "created" : "failed",
          actor_username: parseActorUsername(auth),
        },
      });
    } catch {
      // no-op
    }

    if (safeString(booking.lead_id)) {
      void triggerCrmAutomationBestEffort({
        event: "payment.link_created",
        leadId: safeString(booking.lead_id),
        bookingId: bookingCode,
        payload: {
          booking_id: bookingCode,
          payment_id: paymentIntent.payment.id,
          amount,
          currency,
          payment_url: paymentLink.shortUrl ?? null,
          payment_link_id: paymentLink.id ?? null,
        },
      });
    }

    await recordAnalyticsEvent({
      event: "payment_initiated",
      bookingId: bookingCode,
      paymentId: paymentIntent.payment.id,
      source: "admin_create_payment",
      status: paymentLink.ok ? "link_created" : "intent_created",
    });

    return NextResponse.json({
      ok: true,
      booking_id: bookingCode,
      payment_id: paymentIntent.payment.id,
      razorpay_order_id:
        safeString(paymentLink.id) || safeString(paymentIntent.payment.provider_order_id) || null,
      payment_url: paymentLink.shortUrl ?? null,
      deduped: false,
      warning: paymentLink.ok ? null : "Payment intent created but Razorpay payment link generation failed",
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(500, "Supabase is not configured");
    }
    return routeError(500, "Failed to create payment link");
  }
}
