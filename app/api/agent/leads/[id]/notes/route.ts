import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { addAgentLeadNote } from "@/lib/backend/agentPortal";

type Params = { id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "agent");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const leadRef = decodeURIComponent(resolved.id ?? "").trim();
    if (!leadRef) return NextResponse.json({ success: false, error: "Invalid lead id" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { message?: string };
    const message = safeString(body.message);
    if (!message) {
      return NextResponse.json({ success: false, error: "message is required" }, { status: 400 });
    }

    const result = await addAgentLeadNote(auth.userId, leadRef, message);
    if (!result.ok) return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return routeError(500, "Failed to add lead note");
  }
}
