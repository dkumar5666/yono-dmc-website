import Amadeus from "amadeus";
import { FlightOfferSummary, FlightSearchRequest } from "@/lib/backend/types";
import { getAmadeusConfig } from "@/lib/config/amadeus";

interface AmadeusSegment {
  departure?: { iataCode?: string; at?: string };
  arrival?: { iataCode?: string; at?: string };
  carrierCode?: string;
  number?: string;
  duration?: string;
}

interface AmadeusItinerary {
  duration?: string;
  segments?: AmadeusSegment[];
}

interface AmadeusOffer {
  id?: string;
  price?: { total?: string; currency?: string };
  validatingAirlineCodes?: string[];
  itineraries?: AmadeusItinerary[];
}

interface AmadeusResult {
  data?: AmadeusOffer[];
}

interface AmadeusFlightOrderTraveler {
  [key: string]: unknown;
}

interface AmadeusFlightOrderRequest {
  data: {
    type: "flight-order";
    flightOffers: unknown[];
    travelers: AmadeusFlightOrderTraveler[];
    contacts?: Array<Record<string, unknown>>;
  };
}

interface AmadeusFlightOrderResponse {
  data?: {
    id?: string;
    associatedRecords?: Array<{ reference?: string }>;
  };
}

interface AmadeusFlightOrdersApi {
  booking: {
    flightOrders: {
      post: (body: unknown) => Promise<unknown>;
    };
  };
}

export interface FlightOrderCreateInput {
  offer: unknown;
  travelers: AmadeusFlightOrderTraveler[];
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  } | null;
}

export interface FlightOrderCreateResult {
  orderId: string | null;
  pnr: string | null;
  raw: unknown;
}

let amadeusClient: InstanceType<typeof Amadeus> | null = null;

function getAmadeusClient(): InstanceType<typeof Amadeus> {
  if (amadeusClient) return amadeusClient;

  const { clientId, clientSecret, hostname } = getAmadeusConfig();

  amadeusClient = new Amadeus({
    clientId,
    clientSecret,
    hostname,
  });

  return amadeusClient;
}

function toNumber(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function searchFlights(
  input: FlightSearchRequest
): Promise<FlightOfferSummary[]> {
  const amadeus = getAmadeusClient();

  const response = (await amadeus.shopping.flightOffersSearch.get({
    originLocationCode: input.from,
    destinationLocationCode: input.to,
    departureDate: input.date,
    returnDate: input.returnDate,
    adults: String(input.adults ?? 1),
    children: String(input.children ?? 0),
    infants: String(input.infants ?? 0),
    travelClass: input.travelClass,
    nonStop: input.nonStop,
    currencyCode: input.currency ?? "INR",
    max: String(input.max ?? 20),
  })) as { result?: unknown };

  const result = (response.result ?? {}) as AmadeusResult;
  const offers = result.data ?? [];

  return offers.map((offer, index): FlightOfferSummary => {
    const itineraries = (offer.itineraries ?? []).map((itinerary) => {
      const segments = itinerary.segments ?? [];
      return {
        duration: itinerary.duration ?? "",
        stops: Math.max(segments.length - 1, 0),
        segments: segments.map((segment) => ({
          from: segment.departure?.iataCode ?? "",
          to: segment.arrival?.iataCode ?? "",
          departureAt: segment.departure?.at ?? "",
          arrivalAt: segment.arrival?.at ?? "",
          carrierCode: segment.carrierCode ?? "",
          flightNumber: segment.number ?? "",
          duration: segment.duration ?? "",
        })),
      };
    });

    return {
      id: offer.id ?? `offer-${index + 1}`,
      source: "amadeus",
      currency: offer.price?.currency ?? (input.currency ?? "INR"),
      totalPrice: toNumber(offer.price?.total, 0),
      validatingAirlineCodes: offer.validatingAirlineCodes ?? [],
      itineraries,
      raw: offer,
    };
  });
}

function buildOrderContacts(
  contact: FlightOrderCreateInput["contact"]
): Array<Record<string, unknown>> | undefined {
  if (!contact) return undefined;
  const email = typeof contact.email === "string" ? contact.email.trim() : "";
  const phone = typeof contact.phone === "string" ? contact.phone.trim() : "";
  const name = typeof contact.name === "string" ? contact.name.trim() : "";
  if (!email && !phone && !name) return undefined;

  const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");
  const phoneDigits = phone.replace(/[^\d+]/g, "");

  const contactPayload: Record<string, unknown> = {
    addresseeName: {
      firstName: firstName || "Guest",
      lastName: lastName || "Traveler",
    },
    purpose: "STANDARD",
  };
  if (email) contactPayload.emailAddress = email;
  if (phoneDigits) {
    contactPayload.phones = [
      {
        deviceType: "MOBILE",
        number: phoneDigits.replace(/^\+/, ""),
      },
    ];
  }

  return [contactPayload];
}

function parseFlightOrderResult(raw: unknown): FlightOrderCreateResult {
  const response = raw as { result?: unknown };
  const result = (response?.result ?? {}) as AmadeusFlightOrderResponse;
  const orderId =
    (typeof result.data?.id === "string" && result.data.id.trim()) ||
    null;
  const pnr =
    (typeof result.data?.associatedRecords?.[0]?.reference === "string" &&
      result.data.associatedRecords[0].reference.trim()) ||
    null;

  return {
    orderId,
    pnr,
    raw: result,
  };
}

export async function createFlightOrder(
  input: FlightOrderCreateInput
): Promise<FlightOrderCreateResult> {
  const amadeus = getAmadeusClient();
  const amadeusBookingApi = amadeus as unknown as AmadeusFlightOrdersApi;
  const payload: AmadeusFlightOrderRequest = {
    data: {
      type: "flight-order",
      flightOffers: [input.offer],
      travelers: Array.isArray(input.travelers) ? input.travelers : [],
      ...(buildOrderContacts(input.contact)
        ? { contacts: buildOrderContacts(input.contact) }
        : {}),
    },
  };

  if (!Array.isArray(payload.data.travelers) || payload.data.travelers.length === 0) {
    throw new Error("Amadeus flight order requires at least one traveler.");
  }

  let response: unknown;
  try {
    response = await amadeusBookingApi.booking.flightOrders.post(payload);
  } catch {
    // Some SDK versions expect a JSON string body for POST endpoints.
    response = await amadeusBookingApi.booking.flightOrders.post(JSON.stringify(payload));
  }

  return parseFlightOrderResult(response);
}
