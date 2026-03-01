import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";
import { priceAmadeusFlightOffer, writeAmadeusSupplierLog } from "@/lib/suppliers/amadeus/flights";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapConfigError(message: string): NextResponse | null {
  if (!message.startsWith("Missing env:")) return null;
  const missingEnv = message
    .replace("Missing env:", "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return NextResponse.json(
    {
      ok: false,
      error: "Flight provider is not configured",
      code: "FLIGHT_PROVIDER_NOT_CONFIGURED",
      missingEnv,
    },
    { status: 503 }
  );
}

function mapPricedOfferResponse(priced: NonNullable<Awaited<ReturnType<typeof priceAmadeusFlightOffer>>>) {
  const legacySegments = priced.segments.map((segment) => ({
    from: segment.from || "",
    to: segment.to || "",
    departureAt: segment.departure_at || "",
    arrivalAt: segment.arrival_at || "",
    carrierCode: segment.carrier || "",
    flightNumber: segment.flight_number || "",
    duration: segment.duration || "",
  }));

  return {
    ...priced,
    // Backward-compatible keys for existing /flights UI.
    id: priced.offer_id,
    source: "amadeus",
    totalPrice: priced.total_price ?? 0,
    validatingAirlineCodes: priced.airline ? [priced.airline] : [],
    itineraries: [
      {
        duration: priced.duration || "",
        stops: Math.max(0, legacySegments.length - 1),
        segments: legacySegments,
      },
    ],
    raw: priced.raw_offer,
  };
}

export async function POST(req: Request) {
  const rateLimit = enforceRateLimit(req, {
    key: "public:flights-price-v1:post",
    maxRequests: 80,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const body = (await req.json().catch(() => ({}))) as {
    offer_id?: string;
    raw_offer?: unknown;
  };
  const offerId = safeString(body.offer_id);
  const rawOffer = toObject(body.raw_offer);

  if (!rawOffer) {
    return NextResponse.json(
      { ok: false, error: "raw_offer is required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  try {
    const pricedOffer = await priceAmadeusFlightOffer({
      offer_id: offerId,
      raw_offer: rawOffer,
    });
    if (!pricedOffer) {
      await writeAmadeusSupplierLog({
        action: "flight_price",
        status: "failed",
        message: "Amadeus pricing response did not include flight offers",
        payload: {
          offer_id: offerId || safeString(rawOffer.id) || null,
        },
      });
      return NextResponse.json(
        { ok: false, error: "Unable to price selected offer", code: "PRICE_NOT_AVAILABLE" },
        { status: 422 }
      );
    }

    await writeAmadeusSupplierLog({
      action: "flight_price",
      status: "success",
      message: "Amadeus flight offer priced",
      payload: {
        offer_id: pricedOffer.offer_id,
        total_price: pricedOffer.total_price,
        currency: pricedOffer.currency,
        segment_count: pricedOffer.segments.length,
      },
    });

    return NextResponse.json({
      ok: true,
      priced_offer: mapPricedOfferResponse(pricedOffer),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "pricing_failed";
    const configError = mapConfigError(message);
    if (configError) return configError;
    if (message.includes("Invalid env: AMADEUS_BASE_URL")) {
      return NextResponse.json(
        { ok: false, error: "Flight provider base URL is invalid", code: "FLIGHT_PROVIDER_INVALID_CONFIG" },
        { status: 503 }
      );
    }

    await writeAmadeusSupplierLog({
      action: "flight_price",
      status: "failed",
      message: "Amadeus pricing request failed",
      payload: {
        offer_id: offerId || safeString(rawOffer.id) || null,
        error: message.slice(0, 300),
      },
    });
    return NextResponse.json(
      { ok: false, error: "Failed to price flight offer", code: "FLIGHT_PRICE_FAILED" },
      { status: 500 }
    );
  }
}
