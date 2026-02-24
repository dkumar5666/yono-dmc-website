import { NextResponse } from "next/server";
import { searchFlights } from "@/lib/backend/flights";
import { validateFlightSearchRequest } from "@/lib/backend/validation";

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
    if (message.includes("Amadeus credentials are missing")) {
      return NextResponse.json(
        {
          error: "Flight provider is not configured",
          code: "FLIGHT_PROVIDER_NOT_CONFIGURED",
          missingEnv: ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET"],
        },
        { status: 503 }
      );
    }

    console.error("FLIGHT API ERROR:", error);
    return NextResponse.json({ error: "Flight API failed" }, { status: 500 });
  }
}
