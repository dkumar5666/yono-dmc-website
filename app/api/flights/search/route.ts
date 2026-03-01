import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";
import { searchAmadeusFlightOffers, writeAmadeusSupplierLog } from "@/lib/suppliers/amadeus/flights";

type CabinClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

interface SearchInput {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  currency: string;
  travelClass?: CabinClass;
}

interface CacheEntry {
  expiresAt: number;
  payload: {
    ok: true;
    offers: Array<Record<string, unknown>>;
  };
}

const SEARCH_CACHE = new Map<string, CacheEntry>();

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toUpper(value: unknown): string {
  return safeString(value).toUpperCase();
}

function toInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

function isIata(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTravelClass(value: string): CabinClass | undefined {
  const normalized = value.toUpperCase();
  if (
    normalized === "ECONOMY" ||
    normalized === "PREMIUM_ECONOMY" ||
    normalized === "BUSINESS" ||
    normalized === "FIRST"
  ) {
    return normalized;
  }
  return undefined;
}

function parseGetInput(req: Request): SearchInput {
  const { searchParams } = new URL(req.url);
  return {
    origin: toUpper(searchParams.get("origin")),
    destination: toUpper(searchParams.get("destination")),
    departDate: safeString(searchParams.get("departDate")),
    returnDate: safeString(searchParams.get("returnDate")) || undefined,
    adults: toInt(searchParams.get("adults"), 1),
    currency: toUpper(searchParams.get("currency")) || "INR",
    travelClass: normalizeTravelClass(safeString(searchParams.get("travelClass")) || "ECONOMY"),
  };
}

function parsePostInput(body: Record<string, unknown>): SearchInput {
  // Backward-compatible aliases from existing pages.
  const origin = toUpper(body.origin ?? body.from);
  const destination = toUpper(body.destination ?? body.to);
  const departDate = safeString(body.departDate ?? body.date);
  const travelClassRaw = safeString(body.travelClass);

  return {
    origin,
    destination,
    departDate,
    returnDate: safeString(body.returnDate) || undefined,
    adults: toInt(body.adults, 1),
    currency: toUpper(body.currency) || "INR",
    travelClass: normalizeTravelClass(travelClassRaw || "ECONOMY"),
  };
}

function validateInput(input: SearchInput): string | null {
  if (!isIata(input.origin)) return "origin must be a valid IATA code";
  if (!isIata(input.destination)) return "destination must be a valid IATA code";
  if (!isDate(input.departDate)) return "departDate must be YYYY-MM-DD";
  if (input.returnDate && !isDate(input.returnDate)) return "returnDate must be YYYY-MM-DD";
  if (!Number.isFinite(input.adults) || input.adults < 1 || input.adults > 9) return "adults must be between 1 and 9";
  if (!input.travelClass) return "travelClass is invalid";
  return null;
}

function cacheKey(input: SearchInput): string {
  return [
    input.origin,
    input.destination,
    input.departDate,
    input.returnDate || "",
    String(input.adults),
    input.currency,
    input.travelClass || "",
  ].join("|");
}

function readCache(key: string): CacheEntry["payload"] | null {
  const entry = SEARCH_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return entry.payload;
}

function writeCache(key: string, payload: CacheEntry["payload"]) {
  SEARCH_CACHE.set(key, {
    payload,
    expiresAt: Date.now() + 60_000,
  });
}

function mapOfferForResponse(offer: Awaited<ReturnType<typeof searchAmadeusFlightOffers>>[number]) {
  const legacySegments = offer.segments.map((segment) => ({
    from: segment.from || "",
    to: segment.to || "",
    departureAt: segment.departure_at || "",
    arrivalAt: segment.arrival_at || "",
    carrierCode: segment.carrier || "",
    flightNumber: segment.flight_number || "",
    duration: segment.duration || "",
  }));

  return {
    offer_id: offer.offer_id,
    total_price: offer.total_price,
    airline: offer.airline,
    segments: offer.segments,
    duration: offer.duration,
    refundable: offer.refundable,
    currency: offer.currency,
    raw_offer: offer.raw_offer,
    // Backward-compatible keys for existing /flights UI.
    id: offer.offer_id,
    source: "amadeus",
    totalPrice: offer.total_price ?? 0,
    validatingAirlineCodes: offer.airline ? [offer.airline] : [],
    itineraries: [
      {
        duration: offer.duration || "",
        stops: Math.max(0, legacySegments.length - 1),
        segments: legacySegments,
      },
    ],
    raw: offer.raw_offer,
  };
}

async function runSearch(input: SearchInput) {
  const key = cacheKey(input);
  const cached = readCache(key);
  if (cached) {
    return cached;
  }

  const offers = await searchAmadeusFlightOffers({
    origin: input.origin,
    destination: input.destination,
    departDate: input.departDate,
    returnDate: input.returnDate,
    adults: input.adults,
    currency: input.currency,
    travelClass: input.travelClass,
  });

  const payload = { ok: true as const, offers: offers.map(mapOfferForResponse) };
  writeCache(key, payload);
  return payload;
}

async function logSearch(
  input: SearchInput,
  result: { ok: boolean; offers?: unknown[]; error?: string }
) {
  const commonMeta: Record<string, unknown> = {
    origin: input.origin,
    destination: input.destination,
    departDate: input.departDate,
    returnDate: input.returnDate ?? null,
    adults: input.adults,
    currency: input.currency,
    travelClass: input.travelClass ?? null,
  };

  if (result.ok) {
    await writeAmadeusSupplierLog({
      action: "flight_search",
      status: "success",
      message: "Amadeus flight search success",
      payload: {
        request: commonMeta,
        response_size: Array.isArray(result.offers) ? result.offers.length : 0,
      },
    });
    return;
  }

  await writeAmadeusSupplierLog({
    action: "flight_search",
    status: "failed",
    message: result.error || "Amadeus flight search failed",
    payload: {
      request: commonMeta,
      error: result.error || "search_failed",
    },
  });
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

export async function GET(req: Request) {
  const rateLimit = enforceRateLimit(req, {
    key: "public:flights-search-v1:get",
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const input = parseGetInput(req);
  const validation = validateInput(input);
  if (validation) {
    return NextResponse.json({ ok: false, error: validation, code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const payload = await runSearch(input);
    await logSearch(input, { ok: true, offers: payload.offers });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "search_failed";
    const configError = mapConfigError(message);
    if (configError) return configError;
    if (message.includes("Invalid env: AMADEUS_BASE_URL")) {
      return NextResponse.json(
        { ok: false, error: "Flight provider base URL is invalid", code: "FLIGHT_PROVIDER_INVALID_CONFIG" },
        { status: 503 }
      );
    }
    await logSearch(input, { ok: false, error: message });
    return NextResponse.json({ ok: false, error: "Failed to fetch flight offers", code: "FLIGHT_SEARCH_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const rateLimit = enforceRateLimit(req, {
    key: "public:flights-search-v1:post",
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parsePostInput(body);
  const validation = validateInput(input);
  if (validation) {
    return NextResponse.json({ ok: false, error: validation, code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const payload = await runSearch(input);
    await logSearch(input, { ok: true, offers: payload.offers });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "search_failed";
    const configError = mapConfigError(message);
    if (configError) return configError;
    if (message.includes("Invalid env: AMADEUS_BASE_URL")) {
      return NextResponse.json(
        { ok: false, error: "Flight provider base URL is invalid", code: "FLIGHT_PROVIDER_INVALID_CONFIG" },
        { status: 503 }
      );
    }
    await logSearch(input, { ok: false, error: message });
    return NextResponse.json({ ok: false, error: "Failed to fetch flight offers", code: "FLIGHT_SEARCH_FAILED" }, { status: 500 });
  }
}
