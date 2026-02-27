import { NextResponse } from "next/server";
import { searchFlights } from "@/lib/backend/flights";
import { FlightSearchRequest } from "@/lib/backend/types";
import { validateFlightSearchRequest } from "@/lib/backend/validation";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";

function parseAmadeusMissingEnv(message: string): string[] | null {
  if (!message.startsWith("Missing env:")) return null;
  return message
    .replace("Missing env:", "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const rateLimitResponse = enforceRateLimit(req, {
    key: "public:flights-search",
    maxRequests: 80,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await req.json()) as Partial<FlightSearchRequest>;
    const payload: FlightSearchRequest = {
      from: (body.from ?? "").toUpperCase(),
      to: (body.to ?? "").toUpperCase(),
      date: body.date ?? "",
      returnDate: body.returnDate,
      adults: body.adults ?? 1,
      children: body.children ?? 0,
      infants: body.infants ?? 0,
      travelClass: body.travelClass ?? "ECONOMY",
      nonStop: body.nonStop ?? false,
      currency: body.currency ?? "INR",
      max: body.max ?? 20,
    };

    const validationError = validateFlightSearchRequest(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const offers = await searchFlights(payload);
    return NextResponse.json({ offers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const missingEnv = parseAmadeusMissingEnv(message);
    if (missingEnv) {
      return NextResponse.json(
        {
          error: "Flight provider is not configured",
          code: "FLIGHT_PROVIDER_NOT_CONFIGURED",
          missingEnv,
        },
        { status: 503 }
      );
    }
    if (message.includes("Invalid env: AMADEUS_BASE_URL")) {
      return NextResponse.json(
        {
          error: "Flight provider base URL is invalid",
          code: "FLIGHT_PROVIDER_INVALID_CONFIG",
        },
        { status: 503 }
      );
    }

    console.error("FLIGHT SEARCH ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch flights" }, { status: 500 });
  }
}
