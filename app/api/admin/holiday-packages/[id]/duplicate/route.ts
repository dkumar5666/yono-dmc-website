import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/backend/adminAuth";
import { duplicateHolidayPackage } from "@/lib/backend/travelAdmin";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(req: Request, context: RouteContext) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    const cloned = duplicateHolidayPackage(params.id);
    return NextResponse.json({ data: cloned }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to duplicate package";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
