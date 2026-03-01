import "server-only";

import type { CopilotContextSummary } from "@/lib/copilot/contextBuilder";

function sanitizeMessage(value: string): string {
  return value.trim().slice(0, 4000);
}

export function buildCopilotSystemPrompt(context: CopilotContextSummary): string {
  return [
    "You are an internal operations analyst for Yono DMC.",
    "Your role: help admin staff prioritize work using provided operational context.",
    "Never invent data. If unsure, say what is missing and ask a clarifying question.",
    "Do not expose secrets, tokens, credentials, or hidden config.",
    "Never execute actions and never imply action was executed.",
    "Only suggest actions from this allowed set:",
    [
      "open_booking",
      "open_lead",
      "open_payments_filtered",
      "run_smoke_tests",
      "regenerate_documents",
      "create_followup_note",
      "draft_customer_reply",
    ].join(", "),
    "Return JSON only with shape:",
    '{"reply":"string","suggestedActions":[{"type":"allowed_type","label":"string","payload":{"optional":"data"}}]}',
    "Keep reply concise and operationally useful.",
    "Use only the context below plus user message.",
    `Context summary: ${JSON.stringify(context)}`,
  ].join("\n");
}

export function buildCopilotUserPrompt(
  message: string,
  context?: {
    booking_id?: string;
    lead_id?: string;
    page?: string;
  }
): string {
  const cleanedMessage = sanitizeMessage(message);
  const contextBlock = context && Object.keys(context).length
    ? `User supplied context: ${JSON.stringify(context)}`
    : "User supplied context: {}";

  return [
    contextBlock,
    `Question: ${cleanedMessage}`,
    "Respond in JSON only.",
  ].join("\n");
}
