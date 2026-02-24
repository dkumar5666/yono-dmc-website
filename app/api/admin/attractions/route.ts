import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/backend/adminAuth";
import { saveAttractionsCatalog, getAttractionsCatalog } from "@/lib/backend/attractionsStore";
import { TicketedAttraction } from "@/data/ticketedAttractions";

interface AttractionsBody {
  attractions?: Array<Partial<TicketedAttraction> & Record<string, unknown>>;
}

export async function GET(req: Request) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const catalog = await getAttractionsCatalog();
    return NextResponse.json(catalog);
  } catch (error: unknown) {
    console.error("ADMIN ATTRACTIONS GET ERROR:", error);
    return NextResponse.json({ error: "Failed to load attractions" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const body = (await req.json()) as AttractionsBody;
    if (!Array.isArray(body.attractions)) {
      return NextResponse.json(
        { error: "attractions array is required" },
        { status: 400 }
      );
    }

    const saved = await saveAttractionsCatalog({
      attractions: body.attractions,
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    console.error("ADMIN ATTRACTIONS PUT ERROR:", error);
    return NextResponse.json({ error: "Failed to save attractions" }, { status: 500 });
  }
}
