import { NextResponse } from "next/server";
import { routeError } from "@/lib/middleware/routeError";
import { dispatchCrmAutomation, type CrmAutomationEvent } from "@/lib/crm/automationDispatch";
import { assertInternalRequest } from "@/lib/auth/assertServerAuth";

interface DispatchBody {
  event?: string;
  lead_id?: string;
  booking_id?: string;
  payload?: Record<string, unknown>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseBody(raw: unknown): DispatchBody {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DispatchBody;
}

function normalizeEvent(event: string): CrmAutomationEvent | null {
  if (
    event === "lead.created" ||
    event === "lead.stage_changed" ||
    event === "quote.sent" ||
    event === "booking.won" ||
    event === "payment.link_created"
  ) {
    return event;
  }
  return null;
}

export async function POST(req: Request) {
  const internalDenied = assertInternalRequest(req);
  if (internalDenied) return internalDenied;

  try {
    const body = parseBody(await req.json().catch(() => ({})));
    const event = normalizeEvent(safeString(body.event));
    const leadId = safeString(body.lead_id);
    const bookingId = safeString(body.booking_id);
    if (!event || (!leadId && !bookingId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_payload",
        },
        { status: 400 }
      );
    }

    const result = await dispatchCrmAutomation({
      event,
      leadId: leadId || undefined,
      bookingId: bookingId || undefined,
      payload:
        body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
          ? body.payload
          : undefined,
    });
    return NextResponse.json({
      ok: result.ok,
      deduped: result.deduped,
      lead_id: result.lead_id,
      booking_id: result.booking_id,
      dedup_key: result.dedup_key,
      failures: result.failures ?? 0,
      skipped_reason: result.skipped_reason ?? null,
    });
  } catch {
    return routeError(500, "Failed to dispatch CRM automation");
  }
}
