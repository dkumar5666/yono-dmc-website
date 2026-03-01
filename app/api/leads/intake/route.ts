import { NextResponse } from "next/server";
import {
  createOrDeduplicateLead,
  getClientIp,
  isLeadIntakeRateLimited,
  toSafeErrorCode,
  type LeadIntakeInput,
} from "@/lib/backend/leadIntake";
import { triggerCrmAutomationBestEffort } from "@/lib/crm/automationDispatch";
import { recordAnalyticsEvent, recordRouteDuration } from "@/lib/system/opsTelemetry";

function parseBody(raw: unknown): LeadIntakeInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as LeadIntakeInput;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  let perfStatusCode = 200;
  let perfOutcome: "success" | "fail" | "warn" = "success";

  const ip = getClientIp(req);
  const rate = isLeadIntakeRateLimited(ip);
  if (rate.limited) {
    perfStatusCode = 429;
    perfOutcome = "warn";
    const response = NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Too many requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
        },
      }
    );
    await recordRouteDuration({
      route: "/api/leads/intake",
      durationMs: Date.now() - startedAt,
      statusCode: perfStatusCode,
      outcome: perfOutcome,
    });
    return response;
  }

  try {
    const body = parseBody(await req.json().catch(() => ({})));
    const result = await createOrDeduplicateLead(body, {
      sourceOverride: "website",
      leadCodePrefix: "LEAD",
    });

    if (!result.deduped && result.lead_id) {
      await recordAnalyticsEvent({
        event: "lead_submitted",
        leadId: result.lead_id,
        source: "website",
        status: "created",
      });
      void triggerCrmAutomationBestEffort({
        event: "lead.created",
        leadId: result.lead_id,
      });
    }

    perfStatusCode = 200;
    perfOutcome = "success";
    const response = NextResponse.json({
      ok: true,
      lead_id: result.lead_id,
      deduped: result.deduped,
    });
    await recordRouteDuration({
      route: "/api/leads/intake",
      durationMs: Date.now() - startedAt,
      statusCode: perfStatusCode,
      outcome: perfOutcome,
    });
    return response;
  } catch (error) {
    const code = toSafeErrorCode(error);
    const status =
      code === "destination_required" || code === "contact_required" || code === "spam_rejected"
        ? 400
        : code === "supabase_not_configured"
          ? 503
          : 500;

    perfStatusCode = status;
    perfOutcome = status >= 500 ? "fail" : "warn";
    const response = NextResponse.json(
      {
        ok: false,
        error: code,
      },
      { status }
    );
    await recordRouteDuration({
      route: "/api/leads/intake",
      durationMs: Date.now() - startedAt,
      statusCode: perfStatusCode,
      outcome: perfOutcome,
    });
    return response;
  }
}
