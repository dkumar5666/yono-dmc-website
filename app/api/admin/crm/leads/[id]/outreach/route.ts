import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { runLeadOutreachNow } from "@/lib/crm/outreachScheduler";

type Params = { id: string };

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const leadRef = decodeURIComponent(resolved.id ?? "").trim();
    if (!leadRef) {
      return NextResponse.json({ ok: false, error: "Invalid lead id" }, { status: 404 });
    }

    const result = await runLeadOutreachNow(leadRef);
    const status = result.ok ? 200 : result.reason === "lead_not_found" ? 404 : 500;
    return NextResponse.json(result, { status });
  } catch {
    return routeError(500, "Failed to run lead outreach");
  }
}

