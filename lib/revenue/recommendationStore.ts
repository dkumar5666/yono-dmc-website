import "server-only";

import type { SupabaseRestClient } from "@/lib/core/supabase-rest";
import type { RevenueOptimizerData } from "@/lib/revenue/optimizerRules";

type GenericRow = Record<string, unknown>;

interface StoreRevenueRecommendationsInput {
  db: SupabaseRestClient;
  adminId?: string | null;
  data: RevenueOptimizerData;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso(): string {
  return new Date().toISOString();
}

async function safeInsert(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.insertSingle<GenericRow>(table, payload);
    return true;
  } catch {
    return false;
  }
}

async function saveFallbackSystemLog(
  db: SupabaseRestClient,
  entry: {
    eventType: string;
    entityType: string;
    entityId: string;
    recommendation: Record<string, unknown>;
  }
): Promise<void> {
  const payloads: Array<Record<string, unknown>> = [
    {
      level: "info",
      event: "revenue_recommendation",
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      message: "Revenue optimizer recommendation generated",
      meta: {
        type: entry.eventType,
        recommendation: entry.recommendation,
      },
      created_at: nowIso(),
    },
    {
      event: "revenue_recommendation",
      message: "Revenue optimizer recommendation generated",
      meta: {
        type: entry.eventType,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        recommendation: entry.recommendation,
      },
    },
  ];
  for (const payload of payloads) {
    const ok = await safeInsert(db, "system_logs", payload);
    if (ok) break;
  }
}

async function saveRecommendation(
  db: SupabaseRestClient,
  input: {
    adminId?: string | null;
    leadId?: string | null;
    quoteId?: string | null;
    type: "discount_suggested" | "upsell" | "followup" | "payment_nudge";
    recommendation: Record<string, unknown>;
  }
): Promise<void> {
  const createdAt = nowIso();
  const adminId = safeString(input.adminId);
  const leadId = safeString(input.leadId);
  const quoteId = safeString(input.quoteId);
  const entityId = quoteId || leadId || "revenue";

  const candidates: Array<Record<string, unknown>> = [
    {
      admin_id: adminId || null,
      lead_id: leadId || null,
      quote_id: quoteId || null,
      type: input.type,
      recommendation: input.recommendation,
      created_at: createdAt,
    },
    {
      admin_id: adminId || null,
      lead_id: leadId || null,
      type: input.type,
      recommendation: input.recommendation,
      created_at: createdAt,
    },
    {
      lead_id: leadId || null,
      type: input.type,
      recommendation: input.recommendation,
      created_at: createdAt,
    },
    {
      type: input.type,
      recommendation: input.recommendation,
      created_at: createdAt,
    },
  ];

  for (const payload of candidates) {
    const ok = await safeInsert(db, "revenue_recommendations", payload);
    if (ok) return;
  }

  await saveFallbackSystemLog(db, {
    eventType: input.type,
    entityType: quoteId ? "quotation" : "lead",
    entityId,
    recommendation: input.recommendation,
  });
}

export async function storeRevenueRecommendations(
  input: StoreRevenueRecommendationsInput
): Promise<void> {
  const { db, data, adminId } = input;
  const jobs: Array<Promise<void>> = [];

  for (const lead of data.hotLeads.slice(0, 20)) {
    jobs.push(
      saveRecommendation(db, {
        adminId,
        leadId: lead.lead_id,
        type: "followup",
        recommendation: {
          stage: lead.stage,
          destination: lead.destination,
          inactivity_hours: lead.inactivity_hours,
          suggested_channel: lead.suggested_channel ?? null,
          suggested_message: lead.suggested_message ?? null,
        },
      })
    );
  }

  for (const quote of data.quoteOpportunities.slice(0, 20)) {
    jobs.push(
      saveRecommendation(db, {
        adminId,
        leadId: quote.lead_id,
        quoteId: quote.quote_id,
        type: quote.suggested_discount_percent !== null ? "discount_suggested" : "upsell",
        recommendation: {
          destination: quote.destination,
          current_markup_percent: quote.current_markup_percent,
          recommended_markup_percent: quote.recommended_markup_percent,
          suggested_discount_percent: quote.suggested_discount_percent,
          reason: quote.reason,
          stuck_hours: quote.stuck_hours,
        },
      })
    );
  }

  for (const payment of data.abandonedPayments.slice(0, 20)) {
    jobs.push(
      saveRecommendation(db, {
        adminId,
        leadId: payment.lead_id,
        quoteId: payment.payment_id,
        type: "payment_nudge",
        recommendation: {
          booking_id: payment.booking_id,
          amount: payment.amount,
          currency: payment.currency,
          payment_link: payment.payment_link,
          reminder_gap_hours: payment.reminder_gap_hours,
          suggestion: payment.suggestion,
        },
      })
    );
  }

  await Promise.allSettled(jobs);
}
