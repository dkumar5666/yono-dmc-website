import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import {
  createAdminCrmLead,
  listAdminCrmLeads,
  type CrmLeadCreateInput,
} from "@/lib/backend/crmLeads";

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

function safeString(value: string | null): string {
  return (value ?? "").trim();
}

function safeActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const fromClaims = auth.claims?.username;
  if (typeof fromClaims === "string" && fromClaims.trim()) return fromClaims.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const url = new URL(req.url);
    const result = await listAdminCrmLeads({
      stage: safeString(url.searchParams.get("stage")),
      q: safeString(url.searchParams.get("q")),
      source: safeString(url.searchParams.get("source")),
      assigned_to: safeString(url.searchParams.get("assigned_to")),
      from: safeString(url.searchParams.get("from")),
      to: safeString(url.searchParams.get("to")),
      limit: parseLimit(url.searchParams.get("limit")),
      offset: parseOffset(url.searchParams.get("offset")),
    });
    return NextResponse.json(result);
  } catch {
    return routeError(500, "Failed to load CRM leads");
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json().catch(() => ({}))) as CrmLeadCreateInput;
    const lead = await createAdminCrmLead(body, {
      adminId: auth.userId,
      username: safeActorUsername(auth),
    });

    if (!lead) return routeError(500, "Failed to create lead");
    return NextResponse.json({ lead }, { status: 201 });
  } catch {
    return routeError(500, "Failed to create lead");
  }
}
