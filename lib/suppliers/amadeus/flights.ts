import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { amadeusFetch } from "@/lib/suppliers/amadeus/client";

type GenericRow = Record<string, unknown>;

interface FlightSegment {
  from: string | null;
  to: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  carrier: string | null;
  flight_number: string | null;
  duration: string | null;
}

export interface NormalizedFlightOffer {
  offer_id: string;
  total_price: number | null;
  currency: string | null;
  airline: string | null;
  segments: FlightSegment[];
  duration: string | null;
  refundable: boolean | null;
  raw_offer: Record<string, unknown>;
}

interface AmadeusFlightOffer {
  id?: string;
  price?: {
    total?: string;
    currency?: string;
    grandTotal?: string;
  };
  validatingAirlineCodes?: string[];
  itineraries?: Array<{
    duration?: string;
    segments?: Array<{
      departure?: { iataCode?: string; at?: string };
      arrival?: { iataCode?: string; at?: string };
      carrierCode?: string;
      number?: string;
      duration?: string;
    }>;
  }>;
  priceOptions?: {
    refundableFare?: boolean;
  };
  travelerPricings?: Array<{
    fareDetailsBySegment?: Array<{
      refundable?: boolean;
    }>;
  }>;
}

interface AmadeusFlightOfferSearchResponse {
  data?: AmadeusFlightOffer[];
}

interface AmadeusFlightOfferPriceResponse {
  data?: {
    flightOffers?: AmadeusFlightOffer[];
  };
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

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSegments(offer: AmadeusFlightOffer): FlightSegment[] {
  const itineraries = Array.isArray(offer.itineraries) ? offer.itineraries : [];
  const segments: FlightSegment[] = [];
  for (const itinerary of itineraries) {
    const list = Array.isArray(itinerary?.segments) ? itinerary.segments : [];
    for (const segment of list) {
      segments.push({
        from: safeString(segment?.departure?.iataCode) || null,
        to: safeString(segment?.arrival?.iataCode) || null,
        departure_at: safeString(segment?.departure?.at) || null,
        arrival_at: safeString(segment?.arrival?.at) || null,
        carrier: safeString(segment?.carrierCode) || null,
        flight_number: safeString(segment?.number) || null,
        duration: safeString(segment?.duration) || null,
      });
    }
  }
  return segments;
}

function normalizeDuration(offer: AmadeusFlightOffer): string | null {
  const itineraries = Array.isArray(offer.itineraries) ? offer.itineraries : [];
  if (itineraries.length === 0) return null;
  const durations = itineraries.map((itinerary) => safeString(itinerary?.duration)).filter(Boolean);
  if (durations.length === 0) return null;
  return durations.join(" + ");
}

function normalizeRefundable(offer: AmadeusFlightOffer): boolean | null {
  if (typeof offer.priceOptions?.refundableFare === "boolean") {
    return offer.priceOptions.refundableFare;
  }
  const travelerPricings = Array.isArray(offer.travelerPricings) ? offer.travelerPricings : [];
  for (const traveler of travelerPricings) {
    const fares = Array.isArray(traveler?.fareDetailsBySegment) ? traveler.fareDetailsBySegment : [];
    for (const fare of fares) {
      if (typeof fare?.refundable === "boolean") return fare.refundable;
    }
  }
  return null;
}

function normalizeAirline(offer: AmadeusFlightOffer, segments: FlightSegment[]): string | null {
  const validating = Array.isArray(offer.validatingAirlineCodes)
    ? offer.validatingAirlineCodes.filter((code) => safeString(code))
    : [];
  if (validating.length > 0) return safeString(validating[0]) || null;
  return segments.find((segment) => safeString(segment.carrier))?.carrier ?? null;
}

function normalizeOffer(offer: AmadeusFlightOffer, index: number): NormalizedFlightOffer {
  const segments = normalizeSegments(offer);
  const total =
    toNumber(offer.price?.grandTotal) ??
    toNumber(offer.price?.total) ??
    null;
  const currency = safeString(offer.price?.currency) || null;
  const offerId = safeString(offer.id) || `offer-${index + 1}`;

  return {
    offer_id: offerId,
    total_price: total,
    currency,
    airline: normalizeAirline(offer, segments),
    segments,
    duration: normalizeDuration(offer),
    refundable: normalizeRefundable(offer),
    raw_offer: toObject(offer),
  };
}

async function safeInsertLog(payloads: Array<Record<string, unknown>>) {
  try {
    const db = new SupabaseRestClient();
    for (const payload of payloads) {
      try {
        await db.insertSingle<GenericRow>("supplier_logs", payload);
        return;
      } catch {
        // try next smaller payload
      }
    }
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

export async function writeAmadeusSupplierLog(input: {
  action: "flight_search" | "flight_price" | "add_to_booking";
  status: "success" | "failed";
  message: string;
  bookingId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  const base: Record<string, unknown> = {
    supplier: "amadeus",
    action: input.action,
    status: input.status,
    message: input.message,
    ...(safeString(input.bookingId) ? { booking_id: safeString(input.bookingId) } : {}),
    created_at: now,
  };
  const payload = input.payload ?? {};
  await safeInsertLog([
    {
      ...base,
      payload,
    },
    {
      ...base,
      metadata: payload,
    },
    base,
  ]);
}

export async function searchAmadeusFlightOffers(params: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  currency: string;
  travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
}): Promise<NormalizedFlightOffer[]> {
  const response = await amadeusFetch<AmadeusFlightOfferSearchResponse>(
    "/v2/shopping/flight-offers",
    {
      method: "GET",
      query: {
        originLocationCode: params.origin,
        destinationLocationCode: params.destination,
        departureDate: params.departDate,
        returnDate: params.returnDate,
        adults: params.adults,
        travelClass: params.travelClass,
        currencyCode: params.currency,
        max: 20,
      },
    }
  );

  const offers = Array.isArray(response.data) ? response.data : [];
  return offers.map((offer, index) => normalizeOffer(offer, index));
}

export async function priceAmadeusFlightOffer(input: {
  offer_id?: string;
  raw_offer: Record<string, unknown>;
}): Promise<NormalizedFlightOffer | null> {
  const body = {
    data: {
      type: "flight-offers-pricing",
      flightOffers: [input.raw_offer],
    },
  };

  const response = await amadeusFetch<AmadeusFlightOfferPriceResponse>(
    "/v1/shopping/flight-offers/pricing",
    {
      method: "POST",
      body,
    }
  );

  const offers = response.data?.flightOffers;
  if (!Array.isArray(offers) || offers.length === 0) return null;
  const normalized = normalizeOffer(offers[0], 0);
  if (safeString(input.offer_id) && !safeString(normalized.offer_id)) {
    normalized.offer_id = safeString(input.offer_id);
  }
  return normalized;
}

