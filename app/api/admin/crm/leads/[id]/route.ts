import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import {
  getAdminCrmLeadDetail,
  patchAdminCrmLead,
  type CrmLeadPatchInput,
} from "@/lib/backend/crmLeads";
import { triggerCrmAutomationBestEffort } from "@/lib/crm/automationDispatch";

type Params = { id: string };

function safeActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const fromClaims = auth.claims?.username;
  if (typeof fromClaims === "string" && fromClaims.trim()) return fromClaims.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
}

export async function GET(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const leadRef = decodeURIComponent(resolved.id ?? "").trim();
    if (!leadRef) {
      return NextResponse.json({
        lead: null,
        quotations: [],
        booking: null,
        notes: [],
        timeline: [],
        automations: [],
        outreach_history: [],
      });
    }

    const result = await getAdminCrmLeadDetail(leadRef);
    return NextResponse.json(result);
  } catch {
    return routeError(500, "Failed to load CRM lead");
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const leadRef = decodeURIComponent(resolved.id ?? "").trim();
    if (!leadRef) {
      return NextResponse.json({ success: false, error: "Invalid lead id" }, { status: 404 });
    }

    const before = await getAdminCrmLeadDetail(leadRef);
    const previousStage = (before.lead?.stage ?? "").toString().trim();

    const body = (await req.json().catch(() => ({}))) as CrmLeadPatchInput;
    const lead = await patchAdminCrmLead(leadRef, body, {
      adminId: auth.userId,
      username: safeActorUsername(auth),
    });
    if (!lead) return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });

    const nextStage = (lead.stage ?? "").toString().trim();
    const leadIdForAutomation = (lead.id ?? lead.lead_id ?? lead.lead_code ?? "").toString().trim();
    if (leadIdForAutomation && nextStage && previousStage !== nextStage) {
      void triggerCrmAutomationBestEffort({
        event: "lead.stage_changed",
        leadId: leadIdForAutomation,
      });

      if (nextStage === "quote_sent") {
        void triggerCrmAutomationBestEffort({
          event: "quote.sent",
          leadId: leadIdForAutomation,
        });
      }
      if (nextStage === "won") {
        void triggerCrmAutomationBestEffort({
          event: "booking.won",
          leadId: leadIdForAutomation,
        });
      }
    }

    return NextResponse.json({ lead });
  } catch {
    return routeError(500, "Failed to update CRM lead");
  }
}
