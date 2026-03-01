import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import {
  createAgentLead,
  listAgentLeads,
  type AgentLeadCreateInput,
} from "@/lib/backend/agentPortal";
import { triggerCrmAutomationBestEffort } from "@/lib/crm/automationDispatch";

function safeString(value: string | null): string {
  return (value ?? "").trim();
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: Request) {
  const auth = requireRole(req, "agent");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const url = new URL(req.url);
    const result = await listAgentLeads(auth.userId, {
      stage: safeString(url.searchParams.get("stage")),
      destination: safeString(url.searchParams.get("destination")),
      q: safeString(url.searchParams.get("q")),
      from: safeString(url.searchParams.get("from")),
      to: safeString(url.searchParams.get("to")),
      limit: parseLimit(url.searchParams.get("limit")),
      offset: parseOffset(url.searchParams.get("offset")),
    });
    return NextResponse.json(result);
  } catch {
    return routeError(500, "Failed to load agent leads");
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, "agent");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input: AgentLeadCreateInput = {
      destination: safeString((body.destination as string | null) ?? null),
      travel_start_date: safeString((body.travel_start_date as string | null) ?? null),
      travel_end_date: safeString((body.travel_end_date as string | null) ?? null),
      pax_adults: parseOptionalNumber(body.pax_adults),
      pax_children: parseOptionalNumber(body.pax_children),
      budget: parseOptionalNumber(body.budget),
      requirements: safeString((body.requirements as string | null) ?? null),
      customer_name: safeString((body.customer_name as string | null) ?? null),
      customer_email: safeString((body.customer_email as string | null) ?? null),
      customer_phone: safeString((body.customer_phone as string | null) ?? null),
    };

    if (!input.destination) {
      return NextResponse.json({ success: false, error: "Destination is required" }, { status: 400 });
    }

    const lead = await createAgentLead(auth.userId, input);
    if (!lead) return routeError(500, "Failed to create lead");

    const leadRef = (lead.id || lead.lead_code || lead.lead_id || "").toString().trim();
    if (leadRef) {
      void triggerCrmAutomationBestEffort({
        event: "lead.created",
        leadId: leadRef,
      });
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch {
    return routeError(500, "Failed to create lead");
  }
}
