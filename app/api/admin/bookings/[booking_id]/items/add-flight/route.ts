import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { writeAmadeusSupplierLog } from "@/lib/suppliers/amadeus/flights";

type Params = { booking_id: string };
type GenericRow = Record<string, unknown>;

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
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

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeJsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function truncateJson(value: unknown, maxLength: number): unknown {
  try {
    const encoded = JSON.stringify(value ?? {});
    if (encoded.length <= maxLength) return value;
    return {
      truncated: true,
      original_size: encoded.length,
      preview: encoded.slice(0, maxLength),
    };
  } catch {
    return { truncated: true, original_size: 0, preview: null };
  }
}

function extractOfferIdFromMeta(row: GenericRow): string | null {
  const metadata = toObject(row.metadata);
  const meta = toObject(row.meta);
  const candidates = [
    metadata?.offer_id,
    metadata?.offerId,
    meta?.offer_id,
    meta?.offerId,
  ];
  for (const candidate of candidates) {
    const value = safeString(candidate);
    if (value) return value;
  }
  return null;
}

function extractSegments(value: unknown) {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((entry) => (toObject(entry) ?? {}))
    .map((segment) => ({
      from: safeString(segment.from) || null,
      to: safeString(segment.to) || null,
      departure_at: safeString(segment.departure_at) || null,
      arrival_at: safeString(segment.arrival_at) || null,
      carrier: safeString(segment.carrier) || null,
      flight_number: safeString(segment.flight_number) || null,
      duration: safeString(segment.duration) || null,
    }))
    .filter((segment) => segment.from || segment.to || segment.carrier);
}

function buildRouteTitle(segments: Array<{ from: string | null; to: string | null }>): string {
  if (segments.length === 0) return "Flight";
  const first = safeString(segments[0].from);
  const last = safeString(segments[segments.length - 1].to);
  if (first && last) return `Flight ${first}-${last}`;
  return "Flight";
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

async function safeInsert(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<GenericRow | null> {
  try {
    return await db.insertSingle<GenericRow>(table, payload);
  } catch {
    return null;
  }
}

async function resolveBooking(
  db: SupabaseRestClient,
  bookingRef: string
): Promise<BookingRow | null> {
  const byCode = await safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({
      select: "id,booking_code",
      booking_code: `eq.${bookingRef}`,
    })
  );
  if (byCode) return byCode;
  if (!isUuidLike(bookingRef)) return null;
  return safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({
      select: "id,booking_code",
      id: `eq.${bookingRef}`,
    })
  );
}

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const bookingRef = decodeURIComponent(resolved.booking_id ?? "").trim();
    if (!bookingRef) return routeError(404, "Booking not found");

    const booking = await resolveBooking(db, bookingRef);
    if (!booking || !safeString(booking.id)) return routeError(404, "Booking not found");
    const bookingId = safeString(booking.id);

    const body = (await req.json().catch(() => ({}))) as {
      priced_offer?: unknown;
      passenger_summary?: {
        adults?: number;
        children?: number;
        infants?: number;
      };
    };
    const pricedOffer = toObject(body.priced_offer);
    if (!pricedOffer) {
      return routeError(400, "priced_offer is required");
    }

    const offerId =
      safeString(pricedOffer.offer_id) ||
      safeString(pricedOffer.offerId) ||
      safeString(toObject(pricedOffer.raw_offer)?.id);
    if (!offerId) return routeError(400, "priced_offer.offer_id is required");

    const amount =
      toNumber(pricedOffer.total_price) ??
      toNumber(pricedOffer.total) ??
      toNumber(toObject(pricedOffer.price)?.total) ??
      null;
    const currency =
      safeString(pricedOffer.currency) ||
      safeString(toObject(pricedOffer.price)?.currency) ||
      "INR";
    if (amount === null || amount <= 0) {
      return routeError(400, "priced_offer.total_price must be a positive number");
    }

    const existingRows = await safeSelectMany<GenericRow>(
      db,
      "booking_items",
      new URLSearchParams({
        select: "id,item_type,type,metadata,meta",
        booking_id: `eq.${bookingId}`,
        order: "created_at.desc",
        limit: "200",
      })
    );
    const existing = existingRows.find((row) => {
      const itemType = safeString(row.item_type || row.type).toLowerCase();
      if (itemType !== "flight") return false;
      return extractOfferIdFromMeta(row) === offerId;
    });

    if (existing && safeString(existing.id)) {
      await writeAmadeusSupplierLog({
        bookingId,
        action: "add_to_booking",
        status: "success",
        message: "Flight booking item already exists (idempotent duplicate)",
        payload: {
          offer_id: offerId,
          deduped: true,
          booking_item_id: safeString(existing.id),
        },
      });
      return NextResponse.json({
        ok: true,
        booking_item_id: safeString(existing.id),
        deduped: true,
      });
    }

    const segments = extractSegments(pricedOffer.segments);
    const firstDeparture = segments.find((segment) => safeString(segment.departure_at))?.departure_at || null;
    const lastArrival = [...segments].reverse().find((segment) => safeString(segment.arrival_at))?.arrival_at || null;
    const title = buildRouteTitle(segments);
    const airline = safeString(pricedOffer.airline) || null;
    const duration = safeString(pricedOffer.duration) || null;

    const metadata = {
      title,
      supplier: "amadeus",
      offer_id: offerId,
      airline,
      duration,
      segments,
      passenger_summary: {
        adults: Math.max(0, Math.floor(Number(body.passenger_summary?.adults ?? 0))),
        children: Math.max(0, Math.floor(Number(body.passenger_summary?.children ?? 0))),
        infants: Math.max(0, Math.floor(Number(body.passenger_summary?.infants ?? 0))),
      },
      priced_offer: truncateJson(pricedOffer, 10_000),
    };

    const insertVariants: Array<Record<string, unknown>> = [
      {
        booking_id: bookingId,
        item_type: "flight",
        status: "pending_ticketing",
        currency_code: currency,
        total_amount: amount,
        quantity: 1,
        service_start_at: firstDeparture,
        service_end_at: lastArrival,
        supplier: "amadeus",
        metadata,
      },
      {
        booking_id: bookingId,
        item_type: "flight",
        status: "pending_ticketing",
        currency_code: currency,
        total_amount: amount,
        quantity: 1,
        service_start_at: firstDeparture,
        service_end_at: lastArrival,
        metadata,
      },
      {
        booking_id: bookingId,
        type: "flight",
        status: "pending_ticketing",
        currency: currency,
        amount,
        qty: 1,
        start_date: firstDeparture,
        end_date: lastArrival,
        supplier: "amadeus",
        meta: metadata,
      },
      {
        booking_id: bookingId,
        type: "flight",
        status: "pending_ticketing",
        currency: currency,
        amount,
        qty: 1,
        start_date: firstDeparture,
        end_date: lastArrival,
        meta: metadata,
      },
    ];

    let inserted: GenericRow | null = null;
    for (const payload of insertVariants) {
      inserted = await safeInsert(db, "booking_items", payload);
      if (inserted && safeString(inserted.id)) break;
    }

    if (!inserted || !safeString(inserted.id)) {
      await writeAmadeusSupplierLog({
        bookingId,
        action: "add_to_booking",
        status: "failed",
        message: "Unable to insert flight booking item",
        payload: {
          offer_id: offerId,
          priced_offer_size: safeJsonSize(pricedOffer),
        },
      });
      return routeError(503, "Failed to add flight item to booking");
    }

    await writeAmadeusSupplierLog({
      bookingId,
      action: "add_to_booking",
      status: "success",
      message: "Flight item added to booking",
      payload: {
        offer_id: offerId,
        booking_item_id: safeString(inserted.id),
        airline,
        amount,
        currency,
      },
    });

    return NextResponse.json({
      ok: true,
      booking_item_id: safeString(inserted.id),
      deduped: false,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(503, "Supabase is not configured");
    }
    return routeError(500, "Failed to add flight item to booking");
  }
}
