import Amadeus from "amadeus";
import { FlightOfferSummary, FlightSearchRequest } from "@/lib/backend/types";

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

let amadeusClient: InstanceType<typeof Amadeus> | null = null;

function getAmadeusClient(): InstanceType<typeof Amadeus> {
  if (amadeusClient) return amadeusClient;

  const clientId = process.env.AMADEUS_CLIENT_ID?.trim();
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Amadeus credentials are missing. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET."
    );
  }

  amadeusClient = new Amadeus({
    clientId,
    clientSecret,
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
