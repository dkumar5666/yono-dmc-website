import "server-only";

export const ALLOWED_COPILOT_ACTION_TYPES = [
  "open_booking",
  "open_lead",
  "open_payments_filtered",
  "run_smoke_tests",
  "regenerate_documents",
  "create_followup_note",
  "draft_customer_reply",
] as const;

export type CopilotActionType = (typeof ALLOWED_COPILOT_ACTION_TYPES)[number];

export interface CopilotSuggestedAction {
  type: CopilotActionType;
  label: string;
  payload?: Record<string, unknown>;
}

interface ParsedCopilotOutput {
  reply: string;
  suggestedActions: CopilotSuggestedAction[];
  raw?: unknown;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isAllowedType(value: string): value is CopilotActionType {
  return (ALLOWED_COPILOT_ACTION_TYPES as readonly string[]).includes(value);
}

function cleanLabel(type: CopilotActionType, label: string): string {
  const trimmed = safeString(label);
  if (trimmed) return trimmed.slice(0, 120);
  switch (type) {
    case "open_booking":
      return "Open booking";
    case "open_lead":
      return "Open lead";
    case "open_payments_filtered":
      return "Open pending payments";
    case "run_smoke_tests":
      return "Run smoke tests";
    case "regenerate_documents":
      return "Regenerate documents";
    case "create_followup_note":
      return "Prepare follow-up note";
    case "draft_customer_reply":
      return "Draft customer reply";
    default:
      return "Suggested action";
  }
}

function sanitizePayload(
  type: CopilotActionType,
  payload: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!payload) return undefined;

  if (type === "open_booking") {
    const bookingId = safeString(payload.booking_id || payload.bookingId);
    if (!bookingId) return undefined;
    return { booking_id: bookingId.slice(0, 120) };
  }

  if (type === "open_lead") {
    const leadId = safeString(payload.lead_id || payload.leadId);
    if (!leadId) return undefined;
    return { lead_id: leadId.slice(0, 120) };
  }

  if (type === "open_payments_filtered") {
    const status = safeString(payload.status || "pending").toLowerCase();
    const day = safeString(payload.day).toLowerCase();
    const result: Record<string, unknown> = { status: status || "pending" };
    if (day === "today") result.day = "today";
    const bookingId = safeString(payload.booking_id || payload.bookingId);
    if (bookingId) result.booking_id = bookingId.slice(0, 120);
    return result;
  }

  if (type === "run_smoke_tests") {
    return {};
  }

  if (type === "regenerate_documents") {
    const bookingId = safeString(payload.booking_id || payload.bookingId);
    if (!bookingId) return undefined;
    return { booking_id: bookingId.slice(0, 120) };
  }

  if (type === "create_followup_note") {
    const result: Record<string, unknown> = {};
    const leadId = safeString(payload.lead_id || payload.leadId);
    if (leadId) result.lead_id = leadId.slice(0, 120);
    const bookingId = safeString(payload.booking_id || payload.bookingId);
    if (bookingId) result.booking_id = bookingId.slice(0, 120);
    const draft = safeString(payload.draft || payload.note || payload.message);
    if (draft) result.draft = draft.slice(0, 1000);
    return Object.keys(result).length ? result : undefined;
  }

  if (type === "draft_customer_reply") {
    const result: Record<string, unknown> = {};
    const leadId = safeString(payload.lead_id || payload.leadId);
    if (leadId) result.lead_id = leadId.slice(0, 120);
    const bookingId = safeString(payload.booking_id || payload.bookingId);
    if (bookingId) result.booking_id = bookingId.slice(0, 120);
    const draft = safeString(payload.draft || payload.reply || payload.message);
    if (draft) result.draft = draft.slice(0, 2000);
    return Object.keys(result).length ? result : undefined;
  }

  return undefined;
}

function mapSuggestedAction(raw: unknown): CopilotSuggestedAction | null {
  const record = toObject(raw);
  if (!record) return null;
  const type = safeString(record.type).toLowerCase();
  if (!isAllowedType(type)) return null;
  const payload = sanitizePayload(type, toObject(record.payload));
  if ((type === "open_booking" || type === "open_lead" || type === "regenerate_documents") && !payload) {
    return null;
  }
  return {
    type,
    label: cleanLabel(type, safeString(record.label)),
    payload,
  };
}

function dedupeActions(actions: CopilotSuggestedAction[]): CopilotSuggestedAction[] {
  const seen = new Set<string>();
  const result: CopilotSuggestedAction[] = [];
  for (const action of actions) {
    const key = `${action.type}:${JSON.stringify(action.payload ?? {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
    if (result.length >= 6) break;
  }
  return result;
}

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const directCandidates = [trimmed];
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) directCandidates.push(fencedMatch[1].trim());

  for (const candidate of directCandidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced);
    } catch {
      return null;
    }
  }
  return null;
}

function inferFallbackActions(message: string): CopilotSuggestedAction[] {
  const value = message.toLowerCase();
  const actions: CopilotSuggestedAction[] = [];

  if (value.includes("payment")) {
    actions.push({
      type: "open_payments_filtered",
      label: "Open pending payments",
      payload: { status: "pending" },
    });
  }
  if (value.includes("automation") || value.includes("health") || value.includes("attention")) {
    actions.push({
      type: "run_smoke_tests",
      label: "Run smoke tests",
      payload: {},
    });
  }
  if (value.includes("document") || value.includes("voucher")) {
    actions.push({
      type: "regenerate_documents",
      label: "Regenerate booking documents",
      payload: {},
    });
  }
  if (value.includes("reply") || value.includes("customer")) {
    actions.push({
      type: "draft_customer_reply",
      label: "Draft customer reply",
      payload: {},
    });
  }

  return dedupeActions(actions);
}

export function parseCopilotOutput(raw: string, userMessage: string): ParsedCopilotOutput {
  const trimmed = safeString(raw);
  const parsed = extractJsonObject(trimmed);
  const record = toObject(parsed);

  if (record) {
    const reply =
      safeString(record.reply) ||
      safeString(record.answer) ||
      safeString(record.message) ||
      "I could not generate a structured answer. Please retry with a clearer question.";
    const rawActions = Array.isArray(record.suggestedActions)
      ? record.suggestedActions
      : Array.isArray(record.suggested_actions)
      ? record.suggested_actions
      : Array.isArray(record.actions)
      ? record.actions
      : [];
    const actions = dedupeActions(rawActions.map(mapSuggestedAction).filter((x): x is CopilotSuggestedAction => Boolean(x)));
    return {
      reply,
      suggestedActions: actions.length ? actions : inferFallbackActions(userMessage),
      raw: parsed,
    };
  }

  return {
    reply:
      trimmed ||
      "I could not produce an answer right now. Please retry or run smoke tests for quick diagnostics.",
    suggestedActions: inferFallbackActions(userMessage),
    raw: null,
  };
}
