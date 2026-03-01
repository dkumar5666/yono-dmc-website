import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import {
  getAgentLeadDetail,
  patchAgentLead,
  type AgentLeadPatchInput,
} from "@/lib/backend/agentPortal";
import { triggerCrmAutomationBestEffort } from "@/lib/crm/automationDispatch";

type Params = { id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "agent");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const leadRef = decodeURIComponent(resolved.id ?? "").trim();
    if (!leadRef) {
      return NextResponse.json({ lead: null, quotations: [], booking: null, notes: [] });
    }

    const detail = await getAgentLeadDetail(auth.userId, leadRef);
    return NextResponse.json(detail);
  } catch {
    return routeError(500, "Failed to load lead detail");
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "agent");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const leadRef = decodeURIComponent(resolved.id ?? "").trim();
    if (!leadRef) return NextResponse.json({ success: false, error: "Invalid lead id" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as AgentLeadPatchInput;
    const stage = safeString(body.stage);
    if (!stage) {
      return NextResponse.json({ success: false, error: "stage is required" }, { status: 400 });
    }

    const lead = await patchAgentLead(auth.userId, leadRef, { stage });
    if (!lead) return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });

    const leadId = safeString(lead.id) || safeString(lead.lead_code) || safeString(lead.lead_id);
    if (leadId) {
      void triggerCrmAutomationBestEffort({
        event: "lead.stage_changed",
        leadId,
      });
    }

    return NextResponse.json({ lead });
  } catch {
    return routeError(500, "Failed to update lead");
  }
}
