import { NextResponse } from "next/server";
import { searchFlights } from "@/lib/backend/flights";
import { validateFlightSearchRequest } from "@/lib/backend/validation";

function parseAmadeusMissingEnv(message: string): string[] | null {
  if (!message.startsWith("Missing env:")) return null;
  return message
    .replace("Missing env:", "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from")?.toUpperCase() ?? "";
    const to = searchParams.get("to")?.toUpperCase() ?? "";
    const date = searchParams.get("date");
    const returnDate = searchParams.get("returnDate") ?? undefined;
    const adults = Number(searchParams.get("adults") ?? "1");
    const children = Number(searchParams.get("children") ?? "0");
    const infants = Number(searchParams.get("infants") ?? "0");
    const nonStop = searchParams.get("nonStop") === "true";
    const currency = searchParams.get("currency") ?? "INR";
    const max = Number(searchParams.get("max") ?? "20");

    if (!from || !to || !date) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const request = {
      from,
      to,
      date,
      returnDate,
      adults,
      children,
      infants,
      nonStop,
      currency,
      max,
    };

    const validationError = validateFlightSearchRequest(request);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const offers = await searchFlights({
      ...request,
      date: request.date,
    });

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

    console.error("FLIGHT API ERROR:", error);
    return NextResponse.json({ error: "Flight API failed" }, { status: 500 });
  }
}
