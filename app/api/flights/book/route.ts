import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import { createFlightOrder } from "@/lib/backend/flights";
import { getBookingById, getPaymentIntentById, updateBookingFields } from "@/lib/backend/store";
import { executeGuardedSupplierBooking } from "@/lib/backend/supplierBooking";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { isStagingMode, isSupplierBookingAllowedInStaging } from "@/lib/config/appMode";

type FlightBookRequestBody = {
  booking_id?: string;
  offer?: Record<string, unknown> | null;
  travelers?: Array<Record<string, unknown>>;
};

type SupplierLogStatus = "success" | "failed";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function bookingBelongsToCustomer(
  booking: Awaited<ReturnType<typeof getBookingById>>,
  session: NonNullable<ReturnType<typeof getCustomerSessionFromRequest>>
): boolean {
  if (!booking) return false;
  if (sameText(booking.contact.email, session.email)) return true;
  if (sameText(booking.contact.phone, session.phone)) return true;
  return false;
}

function hashOfferForRef(offer: unknown): string {
  try {
    const value = JSON.stringify(offer ?? {});
    return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
  } catch {
    return "na";
  }
}

function extractOfferRef(offer: Record<string, unknown> | null | undefined): string {
  if (!offer) return "na";
  const direct = safeString(offer.id) || safeString(offer.offerId);
  if (direct) return direct;
  const nested = offer.data && typeof offer.data === "object" ? (offer.data as Record<string, unknown>) : null;
  const nestedId = safeString(nested?.id) || safeString(nested?.offerId);
  if (nestedId) return nestedId;
  const hash = hashOfferForRef(offer);
  return hash || "na";
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Flight supplier booking failed";
}

function extractSupplierErrorPayload(error: unknown): unknown {
  if (!error || typeof error !== "object") return null;
  const row = error as Record<string, unknown>;
  return row.response ?? row.result ?? row.data ?? null;
}

async function writeSupplierLog(params: {
  bookingId: string;
  status: SupplierLogStatus;
  message: string;
  payload?: unknown;
  requestId?: string | null;
}) {
  try {
    const db = new SupabaseRestClient();
    const basePayload: Record<string, unknown> = {
      booking_id: params.bookingId,
      supplier: "amadeus",
      action: "book",
      status: params.status,
      message: params.message,
      ...(params.requestId ? { request_id: params.requestId } : {}),
    };

    const attempts: Array<Record<string, unknown>> = [
      {
        ...basePayload,
        payload: params.payload ?? null,
      },
      basePayload,
    ];

    for (const payload of attempts) {
      try {
        await db.insertSingle<Record<string, unknown>>("supplier_logs", payload);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "supplier_log_insert_failed";
        const lower = message.toLowerCase();
        if (
          lower.includes("42p01") ||
          (lower.includes("relation") && lower.includes("does not exist")) ||
          lower.includes("supplier_logs")
        ) {
          return;
        }
      }
    }
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

async function ensureFlightBookingItem(params: {
  bookingId: string;
  amount: number;
  currency: string;
  offerSnapshot: Record<string, unknown>;
}) {
  try {
    const db = new SupabaseRestClient();
    const existing = await db.selectSingle<Record<string, unknown>>(
      "booking_items",
      new URLSearchParams({
        select: "id,item_type,type",
        booking_id: `eq.${params.bookingId}`,
        or: "(item_type.eq.flight,type.eq.flight)",
        limit: "1",
      })
    );
    if (existing) return;

    const metadata = {
      title: "Flight booking",
      offer_snapshot: params.offerSnapshot,
    };

    const insertAttempts: Array<Record<string, unknown>> = [
      {
        booking_id: params.bookingId,
        item_type: "flight",
        status: "confirmed",
        currency_code: params.currency,
        total_amount: params.amount,
        quantity: 1,
        metadata,
      },
      {
        booking_id: params.bookingId,
        type: "flight",
        status: "confirmed",
        currency: params.currency,
        amount: params.amount,
        qty: 1,
        meta: metadata,
      },
    ];

    for (const payload of insertAttempts) {
      try {
        await db.insertSingle<Record<string, unknown>>("booking_items", payload);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          message.includes("42p01") ||
          (message.includes("relation") && message.includes("does not exist")) ||
          message.includes("booking_items")
        ) {
          return;
        }
      }
    }
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

function isPaymentEligible(
  booking: NonNullable<Awaited<ReturnType<typeof getBookingById>>>,
  paymentIntent: Awaited<ReturnType<typeof getPaymentIntentById>> | null
): boolean {
  if (booking.status !== "paid" && booking.status !== "confirmed") return false;
  if (paymentIntent && paymentIntent.status !== "succeeded") return false;
  return true;
}

/**
 * Dev test note:
 * Call this endpoint twice with the same `booking_id` and same `offer`.
 * First request should create the Amadeus order; second should return `{ skipped: true }`
 * because supplier_action_locks enforces idempotency via unique `idempotency_key`.
 */
export async function POST(req: Request) {
  const session = getCustomerSessionFromRequest(req);
  if (!session) return routeError(401, "Not authenticated");

  try {
    const body = (await req.json()) as FlightBookRequestBody;
    const bookingId = safeString(body.booking_id);
    const offer =
      body.offer && typeof body.offer === "object" ? (body.offer as Record<string, unknown>) : null;
    const travelers = Array.isArray(body.travelers)
      ? body.travelers.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
      : [];

    if (!bookingId || !offer || travelers.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "booking_id, offer, and travelers are required",
        },
        { status: 400 }
      );
    }

    const booking = await getBookingById(bookingId);
    if (!booking) return routeError(404, "Booking not found");
    if (!bookingBelongsToCustomer(booking, session)) {
      return routeError(404, "Booking not found");
    }

    if (booking.status === "cancelled" || booking.status === "failed") {
      return NextResponse.json({ ok: false, error: `Booking is ${booking.status}` }, { status: 400 });
    }

    const paymentIntent = booking.paymentIntentId ? await getPaymentIntentById(booking.paymentIntentId) : null;
    if (!isPaymentEligible(booking, paymentIntent)) {
      return NextResponse.json(
        { ok: false, error: "Payment must be confirmed before supplier booking" },
        { status: 400 }
      );
    }

    if (isStagingMode() && !isSupplierBookingAllowedInStaging()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supplier booking is disabled in staging mode",
        },
        { status: 403 }
      );
    }

    const existingOrderId = safeString((booking as unknown as Record<string, unknown>).amadeusOrderId);
    if (existingOrderId || safeString(booking.pnr)) {
      return NextResponse.json({
        ok: true,
        booking_id: booking.id,
        supplier: "amadeus",
        amadeus_order_id: existingOrderId || undefined,
        pnr: safeString(booking.pnr) || undefined,
        skipped: true,
        reason: "duplicate_supplier_booking",
      });
    }

    const offerRef = extractOfferRef(offer);
    const requestId =
      safeString(req.headers.get("x-request-id")) ||
      safeString((offer as Record<string, unknown>).request_id) ||
      null;

    const guarded = await executeGuardedSupplierBooking({
      bookingId: booking.id,
      supplier: "amadeus",
      action: "book",
      providerRef: offerRef,
      requestId,
      meta: { ref: offerRef, bookingReference: booking.reference },
      execute: async () => {
        await ensureFlightBookingItem({
          bookingId: booking.id,
          amount: booking.amount,
          currency: booking.currency,
          offerSnapshot: offer,
        });

        try {
          const order = await createFlightOrder({
            offer,
            travelers,
            contact: booking.contact,
          });

          await writeSupplierLog({
            bookingId: booking.id,
            status: "success",
            message: "Amadeus flight order created",
            payload: order.raw,
            requestId,
          });

          await updateBookingFields(booking.id, {
            amadeusOrderId: order.orderId ?? undefined,
            pnr: order.pnr ?? booking.pnr,
          });

          return {
            ok: true,
            bookingId: booking.id,
            orderId: order.orderId,
            pnr: order.pnr,
            raw: order.raw,
          };
        } catch (error) {
          await writeSupplierLog({
            bookingId: booking.id,
            status: "failed",
            message: extractErrorMessage(error),
            payload: extractSupplierErrorPayload(error),
            requestId,
          });
          throw error;
        }
      },
    });

    if (guarded.skipped) {
      return NextResponse.json({
        ok: true,
        booking_id: booking.id,
        supplier: "amadeus",
        skipped: true,
        reason: "duplicate_supplier_booking",
      });
    }

    const result = guarded.result as
      | {
          orderId?: string | null;
          pnr?: string | null;
        }
      | undefined;

    return NextResponse.json({
      ok: true,
      booking_id: booking.id,
      supplier: "amadeus",
      amadeus_order_id: result?.orderId ?? undefined,
      pnr: result?.pnr ?? undefined,
      skipped: false,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    console.error("FLIGHT BOOK ERROR:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
