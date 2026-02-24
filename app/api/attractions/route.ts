import { NextResponse } from "next/server";
import { getAttractionsCatalog } from "@/lib/backend/attractionsStore";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesDestination(
  item: {
    countryKey: string;
    countryName: string;
    location: string;
    cities: string[];
    title: string;
  },
  query: string
): boolean {
  if (!query) return true;

  const fields = [
    item.countryKey,
    item.countryName,
    item.location,
    item.title,
    ...item.cities,
  ]
    .map(normalize)
    .filter(Boolean);

  return fields.some((field) => field.includes(query) || query.includes(field));
}

export async function GET(req: Request) {
  try {
    const catalog = await getAttractionsCatalog();
    const { searchParams } = new URL(req.url);
    const destinationQuery = normalize(searchParams.get("destination") ?? "");
    const limit = Math.max(0, Number(searchParams.get("limit") ?? "0"));

    let attractions = catalog.attractions;
    if (destinationQuery) {
      attractions = attractions.filter((item) =>
        matchesDestination(item, destinationQuery)
      );
    }

    if (limit > 0) {
      attractions = attractions.slice(0, limit);
    }

    const countries = catalog.countries.filter((country) =>
      attractions.some((item) => item.countryKey === country.key)
    );

    return NextResponse.json({
      attractions,
      countries,
      updatedAt: catalog.updatedAt,
    });
  } catch (error: unknown) {
    console.error("ATTRACTIONS GET ERROR:", error);
    return NextResponse.json({ error: "Failed to load attractions" }, { status: 500 });
  }
}
