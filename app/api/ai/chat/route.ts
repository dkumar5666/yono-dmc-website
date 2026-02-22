import { apiError, apiSuccess } from "@/lib/backend/http";
import { buildDynamicAIContext } from "@/lib/ai/dynamicContext";
import { supportKnowledge } from "@/lib/ai/supportKnowledge";
import { LeadInput, saveAIExchange, SuggestedAction } from "@/lib/backend/aiConversations";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  message?: string;
  history?: ChatMessage[];
  sessionId?: string;
  lead?: LeadInput;
}

interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
}

function sanitizeText(input: string, maxLen = 2000): string {
  return input.trim().slice(0, maxLen);
}

function extractAnswer(payload: OpenAIResponsePayload): string {
  const direct = (payload.output_text ?? "").trim();
  if (direct) return direct;

  const chunks =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => (item.text ?? "").trim())
      .filter(Boolean) ?? [];

  return chunks.join("\n\n").trim();
}

function detectIntent(message: string): string {
  const value = message.toLowerCase();
  if (
    value.includes("itinerary") ||
    value.includes("my trip") ||
    value.includes("find booking") ||
    value.includes("find my booking")
  ) {
    return "find_trip";
  }
  if (
    value.includes("cancel") ||
    value.includes("cancellation") ||
    value.includes("refund")
  ) {
    return "cancel_or_refund";
  }
  if (
    value.includes("change date") ||
    value.includes("reschedule") ||
    value.includes("change flight")
  ) {
    return "change_date";
  }
  if (value.includes("visa")) return "visa_help";
  if (value.includes("package")) return "package_discovery";
  return "general_support";
}

function actionsByIntent(intent: string): SuggestedAction[] {
  if (intent === "find_trip") {
    return [
      { label: "Open My Trips", href: "/trips" },
      { label: "Find with Itinerary", href: "/trips/forgot-itinerary" },
    ];
  }
  if (intent === "cancel_or_refund") {
    return [
      { label: "Open Refund Policy", href: "/refund-policy" },
      { label: "Contact Support", href: "/support" },
      { label: "Open My Trips", href: "/trips" },
    ];
  }
  if (intent === "change_date") {
    return [
      { label: "Open My Trips", href: "/trips" },
      { label: "Contact Support", href: "/support" },
    ];
  }
  if (intent === "visa_help") {
    return [
      { label: "Open Visa Services", href: "/visa" },
      { label: "Contact Support", href: "/support" },
    ];
  }
  if (intent === "package_discovery") {
    return [
      { label: "Browse Packages", href: "/holidays" },
      { label: "Browse Destinations", href: "/destinations" },
    ];
  }
  return [{ label: "Open Support", href: "/support" }];
}

function fallbackAnswerByIntent(intent: string): string {
  if (intent === "find_trip") {
    return "You can find your booking from /trips using itinerary number and booking email. If you forgot itinerary, open /trips/forgot-itinerary.";
  }
  if (intent === "cancel_or_refund") {
    return "For cancellation/refund, first check policy on /refund-policy, then open /trips and share your itinerary with support for exact supplier rules.";
  }
  if (intent === "change_date") {
    return "Date changes depend on fare/package rules. Open /trips and share your itinerary. For urgent support, use /support.";
  }
  if (intent === "visa_help") {
    return "For visa requirements and guidance, open /visa or contact /support for destination-specific checklist.";
  }
  if (intent === "package_discovery") {
    return "You can explore matching options in /holidays and /destinations. Tell me budget, travel dates, and traveler count for better recommendations.";
  }
  return "I can help with trips, refunds, package discovery, visa, and booking support. Tell me what you need.";
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return apiError(
        req,
        500,
        "OPENAI_KEY_MISSING",
        "OpenAI API key is missing. Set OPENAI_API_KEY in environment."
      );
    }

    const body = (await req.json()) as ChatBody;
    const message = sanitizeText(body.message ?? "");
    if (!message) {
      return apiError(req, 400, "INPUT_REQUIRED", "message is required.");
    }
    const sessionId = sanitizeText(body.sessionId ?? "", 120);
    if (!sessionId) {
      return apiError(req, 400, "SESSION_ID_REQUIRED", "sessionId is required.");
    }
    const intent = detectIntent(message);
    const actions = actionsByIntent(intent);

    const history = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: sanitizeText(item.content ?? ""),
          }))
          .filter((item) => item.content.length > 0)
      : [];

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const dynamicContext = await buildDynamicAIContext(req, message);
    const input = [
      {
        role: "system",
        content:
          "You are Yono DMC support assistant. Be concise, accurate, and action-oriented. Use provided dynamic context. If suggesting something, include relevant internal links. Do not invent unavailable inventory.",
      },
      {
        role: "system",
        content: supportKnowledge,
      },
      {
        role: "system",
        content: dynamicContext,
      },
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 500,
        temperature: 0.4,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as OpenAIResponsePayload;

    let source: "openai" | "fallback" = "openai";
    let answer = "";

    if (!response.ok) {
      source = "fallback";
      answer = fallbackAnswerByIntent(intent);
    } else {
      answer = extractAnswer(data);
      if (!answer) {
        source = "fallback";
        answer = fallbackAnswerByIntent(intent);
      }
    }

    const { conversationId } = saveAIExchange({
      req,
      sessionId,
      userMessage: message,
      assistantMessage: answer,
      intent,
      lead: body.lead,
      actions,
      source,
    });

    return apiSuccess(req, {
      answer,
      intent,
      actions,
      source,
      conversationId,
    });
  } catch {
    return apiError(req, 500, "AI_CHAT_ERROR", "Failed to process AI chat request.");
  }
}
