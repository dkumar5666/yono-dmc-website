import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { addAdminCrmLeadNote, type CrmLeadNoteInput } from "@/lib/backend/crmLeads";

type Params = { id: string };

function safeActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const fromClaims = auth.claims?.username;
  if (typeof fromClaims === "string" && fromClaims.trim()) return fromClaims.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const leadRef = decodeURIComponent(resolved.id ?? "").trim();
    if (!leadRef) {
      return NextResponse.json({ success: false, error: "Invalid lead id" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as CrmLeadNoteInput;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ success: false, error: "Note message is required" }, { status: 400 });
    }

    const result = await addAdminCrmLeadNote(
      leadRef,
      { message },
      {
        adminId: auth.userId,
        username: safeActorUsername(auth),
      }
    );

    if (!result.ok) return routeError(500, "Failed to save lead note");
    return NextResponse.json({ success: true });
  } catch {
    return routeError(500, "Failed to save lead note");
  }
}
