import { NextResponse } from "next/server";
import { searchActivities } from "@/lib/backend/activities";
import { getTicketedAttractionsByDestination } from "@/data/ticketedAttractions";

interface ActivitiesSearchBody {
  destination?: string;
  radius?: number;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ActivitiesSearchBody;
    const destination = (body.destination ?? "").trim();

    if (!destination) {
      return NextResponse.json({ error: "destination is required" }, { status: 400 });
    }

    try {
      const activities = await searchActivities({
        destination,
        radius: Math.min(Math.max(1, Number(body.radius ?? 20)), 100),
      });
      return NextResponse.json({ activities });
    } catch (providerError: unknown) {
      console.warn("ACTIVITIES SEARCH PROVIDER FALLBACK:", providerError);
      const fallback = getTicketedAttractionsByDestination(destination);
      const activities = (fallback?.items ?? []).slice(0, 40).map((item) => ({
        id: item.id,
        name: item.title,
        description: item.description,
        image: item.image,
        bookingLink: item.ticketsHref,
        amount: 0,
        currency: "INR",
        source: "fallback",
        raw: null,
      }));
      return NextResponse.json({
        activities,
        warning: "Live provider unavailable. Showing curated activities.",
      });
    }
  } catch (error: unknown) {
    console.error("ACTIVITIES SEARCH ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}
