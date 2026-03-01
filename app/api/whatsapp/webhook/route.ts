import { NextResponse } from "next/server";
import {
  createOrDeduplicateLead,
  getClientIp,
  toSafeErrorCode,
  type LeadIntakeInput,
} from "@/lib/backend/leadIntake";
import { sanitizePhone } from "@/lib/leads/leadFingerprint";
import { triggerCrmAutomationBestEffort } from "@/lib/crm/automationDispatch";
import { checkBestEffortRateLimit } from "@/lib/security/bestEffortRateLimit";

type JsonObject = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

function normalizeHeaderKey(value: string): string {
  return value.toLowerCase().replaceAll("-", "_");
}

function findFirstByKeys(payload: unknown, keys: string[]): string {
  const keySet = new Set(keys.map((key) => normalizeHeaderKey(key)));
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = normalizeHeaderKey(key);
      if (keySet.has(normalizedKey)) {
        const candidate = safeString(value);
        if (candidate) return candidate;
      }

      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return "";
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferDestination(messageText: string): string {
  const raw = safeString(messageText);
  if (!raw) return "General Inquiry";

  const match = raw.match(/\b(?:to|for|visit)\s+([A-Za-z][A-Za-z\s]{2,40})/i);
  if (match?.[1]) return toTitleCase(match[1].trim());

  return "General Inquiry";
}

function extractLeadInput(payload: unknown): LeadIntakeInput {
  const body = asObject(payload);
  const phone = sanitizePhone(
    findFirstByKeys(body, [
      "phone",
      "mobile",
      "phone_number",
      "msisdn",
      "wa_id",
      "waid",
      "from",
      "sender_phone",
    ])
  );
  const fullName = findFirstByKeys(body, ["name", "full_name", "sender_name", "contact_name", "customer_name"]);
  const messageText = findFirstByKeys(body, [
    "message",
    "text",
    "body",
    "query",
    "content",
    "latest_message",
    "message_text",
  ]);
  const destination = findFirstByKeys(body, ["destination", "travel_destination", "city"]) || inferDestination(messageText);
  const campaign = findFirstByKeys(body, ["campaign", "campaign_name", "template_name"]);
  const sourceHint = findFirstByKeys(body, ["source", "channel", "platform"]);

  const utm: Record<string, string> = {};
  if (campaign) utm.campaign = campaign;
  if (sourceHint) utm.source = sourceHint;
  utm.medium = "whatsapp";

  return {
    full_name: fullName || null,
    phone: phone || null,
    destination: destination || "General Inquiry",
    requirements: messageText || null,
    source: "whatsapp",
    utm,
    page_url: null,
  };
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkBestEffortRateLimit("whatsapp_webhook", ip, {
    maxRequests: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (rate.limited) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const expectedKey = process.env.WHATSAPP_WEBHOOK_KEY?.trim();
  const headerKey = req.headers.get("x-whatsapp-key")?.trim();
  if (!expectedKey || !headerKey || headerKey !== expectedKey) {
    return unauthorized();
  }

  try {
    const rawPayload = await req.json().catch(() => ({}));
    const leadInput = extractLeadInput(rawPayload);

    if (!safeString(leadInput.phone) && !safeString(leadInput.email)) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload", message: "phone not found in webhook payload" },
        { status: 400 }
      );
    }

    const result = await createOrDeduplicateLead(leadInput, {
      sourceOverride: "whatsapp",
      rawPayloadForLogs: rawPayload,
      leadCodePrefix: "WALEAD",
    });

    if (!result.deduped && result.lead_id) {
      void triggerCrmAutomationBestEffort({
        event: "lead.created",
        leadId: result.lead_id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = toSafeErrorCode(error);
    return NextResponse.json({ ok: false, error: code }, { status: 500 });
  }
}
