import { NextResponse } from "next/server";
import { searchHotels } from "@/lib/backend/hotels";

interface HotelSearchBody {
  cityCode?: string;
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
  rooms?: number;
  currency?: string;
  max?: number;
}

function resolveCityName(cityCode: string): string {
  const map: Record<string, string> = {
    DXB: "Dubai",
    AUH: "Abu Dhabi",
    SIN: "Singapore",
    KUL: "Kuala Lumpur",
    DPS: "Bali",
    BKK: "Bangkok",
    HKT: "Phuket",
    TYO: "Tokyo",
    OSA: "Osaka",
    DEL: "Delhi",
    SEL: "Seoul",
    IST: "Istanbul",
    SYD: "Sydney",
    MEL: "Melbourne",
    MRU: "Mauritius",
  };
  return map[cityCode] ?? cityCode;
}

function fallbackHotels(input: {
  cityCode: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  currency: string;
  max: number;
}) {
  const cityName = resolveCityName(input.cityCode);
  const base = [
    { name: `${cityName} Central Hotel`, rating: "4.0", price: 17999 },
    { name: `${cityName} Marina View Stay`, rating: "4.3", price: 21500 },
    { name: `${cityName} Premium Suites`, rating: "4.5", price: 26990 },
    { name: `${cityName} Family Comfort Inn`, rating: "3.9", price: 14900 },
  ].slice(0, input.max);

  return base.map((item, idx) => ({
    hotelId: `fallback-${input.cityCode}-${idx + 1}`,
    name: item.name,
    cityCode: input.cityCode,
    address: `${cityName}, City Center`,
    rating: item.rating,
    offerId: `fallback-offer-${input.cityCode}-${idx + 1}`,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: input.adults,
    totalPrice: item.price,
    currency: input.currency,
    source: "amadeus" as const,
    raw: { fallback: true, provider: "amadeus_unavailable" },
  }));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HotelSearchBody;
    const cityCode = (body.cityCode ?? "").trim().toUpperCase();
    const checkInDate = (body.checkInDate ?? "").trim();
    const checkOutDate = (body.checkOutDate ?? "").trim();

    if (!cityCode || cityCode.length !== 3) {
      return NextResponse.json({ error: "Valid cityCode (IATA 3-letter) is required" }, { status: 400 });
    }
    if (!checkInDate || !checkOutDate) {
      return NextResponse.json({ error: "checkInDate and checkOutDate are required" }, { status: 400 });
    }

    const normalizedInput = {
      cityCode,
      checkInDate,
      checkOutDate,
      adults: Math.max(1, Number(body.adults ?? 2)),
      rooms: Math.max(1, Number(body.rooms ?? 1)),
      currency: (body.currency ?? "INR").toUpperCase(),
      max: Math.min(Math.max(1, Number(body.max ?? 20)), 50),
    };

    try {
      const offers = await searchHotels(normalizedInput);
      return NextResponse.json({ offers });
    } catch (providerError) {
      console.error("HOTEL PROVIDER ERROR, USING FALLBACK:", providerError);
      return NextResponse.json({
        offers: fallbackHotels(normalizedInput),
        warning: "Live hotel inventory temporarily unavailable. Showing fallback offers.",
      });
    }
  } catch (error: unknown) {
    console.error("HOTEL SEARCH ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch hotels" }, { status: 500 });
  }
}
