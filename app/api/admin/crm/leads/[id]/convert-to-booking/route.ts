import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { convertAdminCrmLeadToBooking } from "@/lib/backend/crmLeads";
import { triggerCrmAutomationBestEffort } from "@/lib/crm/automationDispatch";

type Params = { id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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
      return NextResponse.json({ ok: false, error: "Invalid lead id" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { quote_id?: string };
    const result = await convertAdminCrmLeadToBooking(
      leadRef,
      { quoteId: safeString(body.quote_id) || null },
      {
        adminId: auth.userId,
        username: safeActorUsername(auth),
      }
    );

    if (!result.ok) {
      if (result.error === "lead_not_found") {
        return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
      }
      if (result.error === "quote_not_found") {
        return NextResponse.json({ ok: false, error: "No quotation found for this lead" }, { status: 400 });
      }
      if (result.error === "customer_required") {
        return NextResponse.json(
          { ok: false, error: "Lead is missing required customer contact details" },
          { status: 400 }
        );
      }
      return routeError(500, "Failed to convert lead to booking");
    }

    if (result.lead_id) {
      void triggerCrmAutomationBestEffort({
        event: "booking.won",
        leadId: result.lead_id,
        bookingId: result.booking_id ?? undefined,
        payload: {
          booking_id: result.booking_id,
          quotation_id: result.quotation_id,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      booking_id: result.booking_id,
      booking_code: result.booking_code,
      quotation_id: result.quotation_id,
      created: result.created,
    });
  } catch {
    return routeError(500, "Failed to convert lead to booking");
  }
}

