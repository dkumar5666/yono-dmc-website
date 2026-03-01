import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import { bookHotel } from "@/lib/suppliers/hotelProvider";
import {
  getBookingById,
  getPaymentIntentById,
  transitionBookingStatus,
  updateBookingFields,
} from "@/lib/backend/store";
import { executeGuardedSupplierBooking } from "@/lib/backend/supplierBooking";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { isStagingMode, isSupplierBookingAllowedInStaging } from "@/lib/config/appMode";

type HotelBookRequestBody = {
  booking_id?: string;
  hotel_offer?: Record<string, unknown> | null;
  guests?: Array<Record<string, unknown>>;
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

function hashObject(value: unknown): string {
  try {
    return crypto.createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
  } catch {
    return "";
  }
}

function extractHotelOfferRef(hotelOffer: Record<string, unknown> | null | undefined): string {
  if (!hotelOffer) return "na";
  return (
    safeString(hotelOffer.offerId) ||
    safeString(hotelOffer.rateKey) ||
    safeString(hotelOffer.roomKey) ||
    safeString(hotelOffer.id) ||
    hashObject(hotelOffer).slice(0, 16) ||
    "na"
  );
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Hotel supplier booking failed";
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
      supplier: "hotel_provider",
      action: "book",
      status: params.status,
      message: params.message,
      ...(params.requestId ? { request_id: params.requestId } : {}),
    };

    const attempts: Array<Record<string, unknown>> = [
      { ...basePayload, payload: params.payload ?? null },
      basePayload,
    ];

    for (const payload of attempts) {
      try {
        await db.insertSingle<Record<string, unknown>>("supplier_logs", payload);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          message.includes("42p01") ||
          (message.includes("relation") && message.includes("does not exist")) ||
          message.includes("supplier_logs")
        ) {
          return;
        }
      }
    }
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

async function findHotelBookingItemId(bookingId: string): Promise<string | null> {
  try {
    const db = new SupabaseRestClient();
    const existing = await db.selectSingle<Record<string, unknown>>(
      "booking_items",
      new URLSearchParams({
        select: "id,item_type,type",
        booking_id: `eq.${bookingId}`,
        or: "(item_type.eq.hotel,type.eq.hotel)",
        limit: "1",
      })
    );
    return safeString(existing?.id) || null;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("42p01") ||
      (message.includes("relation") && message.includes("does not exist")) ||
      message.includes("booking_items")
    ) {
      return null;
    }
    return null;
  }
}

async function ensureHotelBookingItem(params: {
  bookingId: string;
  amount: number;
  currency: string;
  hotelOffer: Record<string, unknown>;
}): Promise<string | null> {
  const existingId = await findHotelBookingItemId(params.bookingId);
  if (existingId) return existingId;

  try {
    const db = new SupabaseRestClient();
    const metadata = {
      title: "Hotel booking",
      offer_snapshot: params.hotelOffer,
    };

    const insertAttempts: Array<Record<string, unknown>> = [
      {
        booking_id: params.bookingId,
        item_type: "hotel",
        status: "confirmed",
        currency_code: params.currency,
        total_amount: params.amount,
        quantity: 1,
        metadata,
      },
      {
        booking_id: params.bookingId,
        type: "hotel",
        status: "confirmed",
        currency: params.currency,
        amount: params.amount,
        qty: 1,
        meta: metadata,
      },
    ];

    for (const payload of insertAttempts) {
      try {
        const inserted = await db.insertSingle<Record<string, unknown>>("booking_items", payload);
        return safeString(inserted?.id) || null;
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          message.includes("42p01") ||
          (message.includes("relation") && message.includes("does not exist")) ||
          message.includes("booking_items")
        ) {
          return null;
        }
      }
    }
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
  }

  return null;
}

async function attachHotelConfirmationToBookingItem(params: {
  bookingId: string;
  itemId: string | null;
  confirmationNumber: string;
  supplierBookingId: string;
}) {
  const itemId = safeString(params.itemId);
  if (!itemId) return;

  try {
    const db = new SupabaseRestClient();
    const query = new URLSearchParams({ id: `eq.${itemId}` });
    const existing = await db.selectSingle<Record<string, unknown>>(
      "booking_items",
      new URLSearchParams({
        id: `eq.${itemId}`,
        select: "meta,metadata",
      })
    );

    const patchCommon = {
      confirmationNumber: params.confirmationNumber,
      supplierBookingId: params.supplierBookingId,
      bookingId: params.bookingId,
    };

    const attempts: Array<Record<string, unknown>> = [
      {
        metadata:
          existing?.metadata && typeof existing.metadata === "object"
            ? { ...(existing.metadata as Record<string, unknown>), ...patchCommon }
            : patchCommon,
      },
      {
        meta:
          existing?.meta && typeof existing.meta === "object"
            ? { ...(existing.meta as Record<string, unknown>), ...patchCommon }
            : patchCommon,
      },
    ];

    for (const payload of attempts) {
      try {
        await db.updateSingle("booking_items", query, payload);
        return;
      } catch {
        // try next shape
      }
    }
  } catch {
    // best-effort only
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
 * Call this endpoint twice with the same `booking_id` and same `hotel_offer`.
 * First request executes supplier booking; second returns `{ skipped: true }`
 * because `supplier_action_locks` blocks duplicate supplier bookings.
 */
export async function POST(req: Request) {
  const session = getCustomerSessionFromRequest(req);
  if (!session) return routeError(401, "Not authenticated");

  try {
    const body = (await req.json()) as HotelBookRequestBody;
    const bookingId = safeString(body.booking_id);
    const hotelOffer =
      body.hotel_offer && typeof body.hotel_offer === "object"
        ? (body.hotel_offer as Record<string, unknown>)
        : null;
    const guests = Array.isArray(body.guests)
      ? body.guests.filter(
          (row): row is Record<string, unknown> => Boolean(row && typeof row === "object")
        )
      : [];

    if (!bookingId || !hotelOffer || guests.length === 0) {
      return NextResponse.json(
        { ok: false, error: "booking_id, hotel_offer, and guests are required" },
        { status: 400 }
      );
    }

    const booking = await getBookingById(bookingId);
    if (!booking) return routeError(404, "Booking not found");
    if (!bookingBelongsToCustomer(booking, session)) return routeError(404, "Booking not found");

    if (booking.status === "cancelled" || booking.status === "failed") {
      return NextResponse.json({ ok: false, error: `Booking is ${booking.status}` }, { status: 400 });
    }

    if (safeString(booking.hotelConfirmationNumber) || safeString(booking.hotelSupplierBookingId)) {
      return NextResponse.json({
        ok: true,
        booking_id: booking.id,
        supplier: "hotel_provider",
        confirmationNumber: safeString(booking.hotelConfirmationNumber) || undefined,
        supplierBookingId: safeString(booking.hotelSupplierBookingId) || undefined,
        skipped: true,
        reason: "duplicate_supplier_booking",
      });
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

    const existingHotelItemId = await findHotelBookingItemId(booking.id);
    const offerRef = extractHotelOfferRef(hotelOffer);
    const ref = existingHotelItemId || offerRef || hashObject(hotelOffer).slice(0, 16) || "na";
    const requestId =
      safeString(req.headers.get("x-request-id")) ||
      safeString(hotelOffer.request_id) ||
      null;

    const guarded = await executeGuardedSupplierBooking({
      bookingId: booking.id,
      supplier: "hotel_provider",
      action: "book",
      itemId: existingHotelItemId,
      providerRef: ref,
      requestId,
      meta: { ref, bookingReference: booking.reference },
      execute: async () => {
        const ensuredItemId = await ensureHotelBookingItem({
          bookingId: booking.id,
          amount: booking.amount,
          currency: booking.currency,
          hotelOffer,
        });

        try {
          const result = await bookHotel({
            booking,
            hotelOffer,
            guestDetails: guests,
          });

          await writeSupplierLog({
            bookingId: booking.id,
            status: "success",
            message: "Hotel supplier booking created",
            payload: result.rawResponse,
            requestId,
          });

          await attachHotelConfirmationToBookingItem({
            bookingId: booking.id,
            itemId: ensuredItemId ?? existingHotelItemId,
            confirmationNumber: result.confirmationNumber,
            supplierBookingId: result.supplierBookingId,
          });

          await updateBookingFields(booking.id, {
            hotelConfirmationNumber: result.confirmationNumber,
            hotelSupplierBookingId: result.supplierBookingId,
          });

          if (booking.status === "paid") {
            await transitionBookingStatus(booking.id, "confirmed");
          }

          return {
            ok: true,
            bookingId: booking.id,
            confirmationNumber: result.confirmationNumber,
            supplierBookingId: result.supplierBookingId,
            raw: result.rawResponse,
          };
        } catch (error) {
          await writeSupplierLog({
            bookingId: booking.id,
            status: "failed",
            message: extractErrorMessage(error),
            payload:
              error && typeof error === "object"
                ? (error as Record<string, unknown>)
                : { error: extractErrorMessage(error) },
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
        supplier: "hotel_provider",
        skipped: true,
        reason: "duplicate_supplier_booking",
      });
    }

    const result = guarded.result as
      | {
          confirmationNumber?: string | null;
          supplierBookingId?: string | null;
        }
      | undefined;

    return NextResponse.json({
      ok: true,
      booking_id: booking.id,
      supplier: "hotel_provider",
      confirmationNumber: result?.confirmationNumber ?? undefined,
      supplierBookingId: result?.supplierBookingId ?? undefined,
      skipped: false,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    console.error("HOTEL BOOK ERROR:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
