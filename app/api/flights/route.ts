import { NextResponse } from "next/server";
import Amadeus from "amadeus";

const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID!,
  clientSecret: process.env.AMADEUS_CLIENT_SECRET!,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const date = searchParams.get("date");

    if (!from || !to || !date) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: from,
      destinationLocationCode: to,
      departureDate: date,
      adults: "1",
      max: "10",
    });

    return NextResponse.json(response.result);
  } catch (error: unknown) {
    console.error("FLIGHT API ERROR:", error);
    return NextResponse.json(
      { error: "Flight API failed" },
      { status: 500 }
    );
  }
}
