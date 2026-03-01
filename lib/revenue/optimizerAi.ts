import "server-only";

import type {
  AbandonedPaymentItem,
  HotLeadItem,
  QuoteOpportunityItem,
  WeeklyInsights,
} from "@/lib/revenue/optimizerRules";

type SuggestedChannel = "call" | "whatsapp" | "email";

interface RevenueAiInput {
  hotLeads: HotLeadItem[];
  quoteOpportunities: QuoteOpportunityItem[];
  abandonedPayments: AbandonedPaymentItem[];
  insights: WeeklyInsights;
}

interface RevenueAiOutput {
  hotLeadSuggestions: Array<{
    lead_id: string;
    channel: SuggestedChannel;
    message: string;
  }>;
  weeklySummary: string;
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

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIsoDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function parseText(payload: OpenAIResponsePayload): string {
  const direct = safeString(payload.output_text);
  if (direct) return direct;
  const chunks =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => safeString(item.text))
      .filter(Boolean) ?? [];
  return chunks.join("\n").trim();
}

function parseJsonObject(text: string): RevenueAiOutput | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");
    candidates.push(withoutFence.trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as RevenueAiOutput;
      if (!parsed || typeof parsed !== "object") continue;
      const suggestions = Array.isArray(parsed.hotLeadSuggestions)
        ? parsed.hotLeadSuggestions
            .map((entry) => {
              const leadId = safeString(entry?.lead_id);
              const channelRaw = safeString(entry?.channel).toLowerCase();
              const message = safeString(entry?.message);
              if (!leadId || !message) return null;
              const channel: SuggestedChannel =
                channelRaw === "call" || channelRaw === "email" ? channelRaw : "whatsapp";
              return { lead_id: leadId, channel, message: message.slice(0, 280) };
            })
            .filter((entry): entry is { lead_id: string; channel: SuggestedChannel; message: string } => Boolean(entry))
        : [];
      return {
        hotLeadSuggestions: suggestions,
        weeklySummary: safeString(parsed.weeklySummary).slice(0, 1800),
      };
    } catch {
      // keep trying candidates
    }
  }
  return null;
}

function fallbackHotLeadSuggestion(lead: HotLeadItem): {
  channel: SuggestedChannel;
  message: string;
} {
  const inactivity = lead.inactivity_hours;
  const stage = safeString(lead.stage).toLowerCase();
  const destination = safeString(lead.destination) || "their trip";
  const leadName = safeString(lead.customer_name) || "Customer";

  let channel: SuggestedChannel = "whatsapp";
  if (inactivity >= 72 || (lead.budget ?? 0) >= 200000) channel = "call";
  else if (stage === "qualified") channel = "whatsapp";
  else if (stage === "negotiation") channel = "call";

  let message = `Hi ${leadName}, sharing a quick check-in on your ${destination} plan.`;
  if (stage === "quote_sent") {
    message = `Hi ${leadName}, did you get time to review your ${destination} quote? I can help with any changes today.`;
  } else if (stage === "negotiation") {
    message = `Hi ${leadName}, I can help finalize your ${destination} booking today with best-available options.`;
  } else if (stage === "qualified") {
    message = `Hi ${leadName}, we have started your ${destination} plan. Please confirm preferences so we can share the best package.`;
  }

  return { channel, message: message.slice(0, 280) };
}

function fallbackWeeklySummary(input: RevenueAiInput): string {
  const topDestination = input.insights.topDestinations[0]?.destination ?? "N/A";
  const topChannel = input.insights.channelConversion[0]?.source ?? "N/A";
  const conversion = input.insights.channelConversion[0]?.conversion_rate ?? 0;
  const staleQuotes = input.quoteOpportunities.filter((item) => item.stuck_hours >= 48).length;
  const abandoned = input.abandonedPayments.length;
  const hot = input.hotLeads.length;

  return [
    `Top destination this week: ${topDestination}.`,
    `Best converting channel: ${topChannel} (${conversion}% conversion).`,
    `${hot} hot leads need follow-up and ${staleQuotes} quotes are stale beyond 48 hours.`,
    `${abandoned} abandoned payments need reminder action.`,
    "Prioritize hot leads with call support first, then resolve stale quote pricing gaps with controlled discounts.",
  ].join("\n");
}

async function callOpenAi(input: RevenueAiInput): Promise<RevenueAiOutput | null> {
  const apiKey = safeString(process.env.OPENAI_API_KEY);
  if (!apiKey) return null;
  const model = safeString(process.env.OPENAI_MODEL) || "gpt-4o-mini";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const payload = {
      hotLeads: input.hotLeads.slice(0, 20).map((lead) => ({
        lead_id: lead.lead_id,
        stage: lead.stage,
        destination: lead.destination,
        budget: lead.budget,
        inactivity_hours: lead.inactivity_hours,
        last_activity_at: toIsoDate(lead.last_activity_at),
      })),
      quoteOpportunities: input.quoteOpportunities.slice(0, 10).map((item) => ({
        lead_id: item.lead_id,
        quote_id: item.quote_id,
        destination: item.destination,
        current_markup_percent: item.current_markup_percent,
        recommended_markup_percent: item.recommended_markup_percent,
        suggested_discount_percent: item.suggested_discount_percent,
        stuck_hours: item.stuck_hours,
      })),
      abandonedPayments: input.abandonedPayments.slice(0, 10).map((item) => ({
        booking_id: item.booking_id,
        amount: item.amount,
        currency: item.currency,
        reminder_gap_hours: item.reminder_gap_hours,
      })),
      insights: {
        topDestinations: input.insights.topDestinations.slice(0, 5),
        channelConversion: input.insights.channelConversion.slice(0, 5),
        avgHoursToClose: input.insights.avgHoursToClose,
        lossReasons: input.insights.lossReasons.slice(0, 5),
      },
    };

    const systemPrompt =
      "You are an internal revenue optimization analyst for a travel operations team. " +
      "Return strict JSON only with keys hotLeadSuggestions and weeklySummary. " +
      "hotLeadSuggestions must include lead_id, channel(call|whatsapp|email), and short message under 280 chars. " +
      "Never invent lead_id values. If unsure, skip that lead. Keep weeklySummary under 10 concise lines.";
    const userPrompt = `Data:\n${JSON.stringify(payload)}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_output_tokens: 700,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const json = (await response.json().catch(() => ({}))) as OpenAIResponsePayload;
    if (!response.ok) return null;
    const text = parseText(json);
    return parseJsonObject(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichRevenueOptimizerWithAi(
  input: RevenueAiInput
): Promise<{ hotLeads: HotLeadItem[]; summary: string }> {
  const ai = await callOpenAi(input);
  const suggestionMap = new Map<string, { channel: SuggestedChannel; message: string }>();

  for (const lead of input.hotLeads) {
    suggestionMap.set(lead.lead_id, fallbackHotLeadSuggestion(lead));
  }
  if (ai) {
    for (const suggestion of ai.hotLeadSuggestions) {
      suggestionMap.set(suggestion.lead_id, {
        channel: suggestion.channel,
        message: suggestion.message,
      });
    }
  }

  const hotLeads = input.hotLeads.map((lead) => {
    const suggestion = suggestionMap.get(lead.lead_id);
    if (!suggestion) return lead;
    return {
      ...lead,
      suggested_channel: suggestion.channel,
      suggested_message: suggestion.message,
    };
  });

  const summary = ai?.weeklySummary || fallbackWeeklySummary(input);
  return { hotLeads, summary };
}

