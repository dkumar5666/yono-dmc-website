import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/backend/adminAuth";
import { deleteDestination, updateDestination, type DestinationInput } from "@/lib/backend/travelAdmin";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function PUT(req: Request, context: RouteContext) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    const body = (await req.json()) as DestinationInput;
    const updated = updateDestination(params.id, body);
    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update destination";
    const status =
      message.includes("required") || message.includes("must")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    deleteDestination(params.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete destination";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
