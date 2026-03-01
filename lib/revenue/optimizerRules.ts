import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { priceQuote } from "@/lib/pricing/engine";

type GenericRow = Record<string, unknown>;

export interface RevenueAction {
  type: "open_lead" | "open_quote" | "recalc_quote" | "send_followup_now";
  label: string;
  payload?: Record<string, unknown>;
}

export interface HotLeadItem {
  lead_id: string;
  lead_code: string | null;
  customer_name: string | null;
  destination: string | null;
  stage: string;
  budget: number | null;
  inactivity_hours: number;
  outreach_count: number;
  last_activity_at: string | null;
  suggested_channel?: "call" | "whatsapp" | "email";
  suggested_message?: string;
  actions: RevenueAction[];
}

export interface QuoteOpportunityItem {
  lead_id: string;
  lead_code: string | null;
  quote_id: string;
  quote_code: string | null;
  destination: string | null;
  quote_status: string | null;
  current_markup_percent: number | null;
  recommended_markup_percent: number | null;
  suggested_discount_percent: number | null;
  floor_margin_percent: number;
  reason: string;
  stuck_hours: number;
  actions: RevenueAction[];
}

export interface AbandonedPaymentItem {
  booking_id: string;
  booking_code: string | null;
  lead_id: string | null;
  payment_id: string;
  amount: number | null;
  currency: string | null;
  payment_status: string | null;
  payment_link: string | null;
  last_reminder_at: string | null;
  reminder_gap_hours: number | null;
  suggestion: string;
  actions: RevenueAction[];
}

export interface WeeklyInsights {
  topDestinations: Array<{ destination: string; total_leads: number; won_leads: number }>;
  channelConversion: Array<{ source: string; total: number; won: number; conversion_rate: number }>;
  avgHoursToClose: number | null;
  lossReasons: Array<{ reason: string; count: number }>;
  summary: string;
}

export interface RevenueOptimizerData {
  hotLeads: HotLeadItem[];
  quoteOpportunities: QuoteOpportunityItem[];
  abandonedPayments: AbandonedPaymentItem[];
  insights: WeeklyInsights;
}

const HOT_STAGES = new Set(["qualified", "quote_sent", "negotiation"]);

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseIsoMs(value: unknown): number | null {
  const v = safeString(value);
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function hoursBetween(nowMs: number, valueMs: number | null): number {
  if (!valueMs) return 0;
  return Math.max(0, (nowMs - valueMs) / (1000 * 60 * 60));
}

function parseLeadStage(row: GenericRow): string {
  const metadata = toObject(row.metadata);
  const pipeline = safeString(metadata.pipeline_stage).toLowerCase();
  if (pipeline) return pipeline;
  const status = safeString(row.status).toLowerCase();
  if (status === "quotation_sent") return "quote_sent";
  if (status === "lead_created") return "new";
  if (status === "qualified") return "qualified";
  if (status === "won") return "won";
  if (status === "lost") return "lost";
  return pipeline || status || "new";
}

function destinationFromLead(row: GenericRow): string | null {
  const city = safeString(row.destination_city);
  const country = safeString(row.destination_country);
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  const metadata = toObject(row.metadata);
  return safeString(metadata.destination) || null;
}

function leadBudget(row: GenericRow): number | null {
  const direct = toNumber(row.budget);
  if (direct !== null) return direct;
  const metadata = toObject(row.metadata);
  return toNumber(metadata.budget) ?? toNumber(metadata.budget_max) ?? null;
}

function leadCustomerName(row: GenericRow): string | null {
  const metadata = toObject(row.metadata);
  return (
    safeString(metadata.customer_name) ||
    safeString(row.customer_name) ||
    null
  );
}

function getOutreachState(row: GenericRow): { count: number; doNotContact: boolean; lastOutreachAt: string | null } {
  const metadata = toObject(row.metadata);
  const count = Math.max(0, Math.floor(toNumber(metadata.outreach_count) ?? 0));
  const doNotContact = Boolean(metadata.do_not_contact);
  const lastOutreachAt = safeString(metadata.last_outreach_at) || null;
  return { count, doNotContact, lastOutreachAt };
}

function paymentLinkFromPayment(row: GenericRow): string | null {
  const rawPayload = toObject(row.raw_payload);
  const raw = toObject(row.raw);
  return (
    safeString(rawPayload.payment_url) ||
    safeString(rawPayload.payment_link_url) ||
    safeString(rawPayload.short_url) ||
    safeString(raw.payment_url) ||
    safeString(raw.payment_link_url) ||
    safeString(raw.short_url) ||
    safeString(row.payment_link_url) ||
    safeString(row.public_payment_url) ||
    null
  );
}

function normalizeQuoteId(row: GenericRow): string {
  return safeString(row.id) || safeString(row.quotation_id) || safeString(row.quotation_code);
}

function normalizeLeadId(row: GenericRow): string {
  return safeString(row.id) || safeString(row.lead_code);
}

async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    const rows = await db.selectMany<T>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function fetchLeads(db: SupabaseRestClient): Promise<GenericRow[]> {
  return safeSelectMany<GenericRow>(
    db,
    "leads",
    new URLSearchParams({
      select: "id,lead_code,status,source,budget,destination_city,destination_country,metadata,updated_at,created_at",
      order: "updated_at.desc",
      limit: "1000",
    })
  );
}

async function fetchQuotations(db: SupabaseRestClient): Promise<GenericRow[]> {
  return safeSelectMany<GenericRow>(
    db,
    "quotations",
    new URLSearchParams({
      select:
        "id,quotation_id,quotation_code,lead_id,status,total_amount,amount,base_amount,net_amount,currency_code,currency,metadata,created_at,updated_at",
      order: "updated_at.desc",
      limit: "1000",
    })
  );
}

async function fetchBookings(db: SupabaseRestClient): Promise<GenericRow[]> {
  return safeSelectMany<GenericRow>(
    db,
    "bookings",
    new URLSearchParams({
      select: "id,booking_code,lead_id,payment_status,created_at,updated_at",
      order: "updated_at.desc",
      limit: "1000",
    })
  );
}

async function fetchPayments(db: SupabaseRestClient): Promise<GenericRow[]> {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return safeSelectMany<GenericRow>(
    db,
    "payments",
    new URLSearchParams({
      select:
        "id,booking_id,status,amount,currency_code,currency,payment_link_url,public_payment_url,raw_payload,raw,metadata,created_at,updated_at",
      created_at: `gte.${sinceIso}`,
      order: "updated_at.desc",
      limit: "1200",
    })
  );
}

async function fetchRecentOutreachLogs(db: SupabaseRestClient): Promise<GenericRow[]> {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return safeSelectMany<GenericRow>(
    db,
    "system_logs",
    new URLSearchParams({
      select: "id,event,entity_type,entity_id,message,meta,metadata,created_at",
      created_at: `gte.${sinceIso}`,
      order: "created_at.desc",
      limit: "1600",
    })
  );
}

function findLastReminderByBooking(logs: GenericRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of logs) {
    const event = safeString(row.event).toLowerCase();
    if (!event.includes("outreach") && !event.includes("payment_reminder")) continue;
    const metadata = toObject(row.meta);
    const metadata2 = toObject(row.metadata);
    const bookingId =
      safeString(metadata.booking_id) ||
      safeString(metadata2.booking_id) ||
      safeString(row.entity_id);
    if (!bookingId || map.has(bookingId)) continue;
    const createdAt = safeString(row.created_at);
    if (createdAt) map.set(bookingId, createdAt);
  }
  return map;
}

function toTop20<T>(items: T[]): T[] {
  return items.slice(0, 20);
}

function inferLossReasons(leads: GenericRow[]): Array<{ reason: string; count: number }> {
  const reasonMap = new Map<string, number>();
  for (const lead of leads) {
    const stage = parseLeadStage(lead);
    if (stage !== "lost") continue;
    const metadata = toObject(lead.metadata);
    const candidate =
      safeString(metadata.loss_reason) ||
      safeString(metadata.reason_lost) ||
      safeString(metadata.reason) ||
      "unknown";
    const key = candidate.toLowerCase();
    reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
  }
  return [...reasonMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({ reason, count }));
}

function buildInsights(
  leads: GenericRow[],
  quotes: GenericRow[],
  nowMs: number
): WeeklyInsights {
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recentLeads = leads.filter((lead) => (parseIsoMs(lead.created_at) ?? 0) >= sevenDaysAgo);
  const sourceStats = new Map<string, { total: number; won: number }>();
  const destinationStats = new Map<string, { total: number; won: number }>();

  const closeDurations: number[] = [];
  for (const lead of recentLeads) {
    const stage = parseLeadStage(lead);
    const source = safeString(lead.source) || "unknown";
    const dest = destinationFromLead(lead) || "Unknown";
    const sourceNode = sourceStats.get(source) ?? { total: 0, won: 0 };
    sourceNode.total += 1;
    if (stage === "won") sourceNode.won += 1;
    sourceStats.set(source, sourceNode);

    const destinationNode = destinationStats.get(dest) ?? { total: 0, won: 0 };
    destinationNode.total += 1;
    if (stage === "won") destinationNode.won += 1;
    destinationStats.set(dest, destinationNode);

    if (stage === "won") {
      const createdMs = parseIsoMs(lead.created_at);
      const updatedMs = parseIsoMs(lead.updated_at);
      if (createdMs && updatedMs && updatedMs > createdMs) {
        closeDurations.push((updatedMs - createdMs) / (1000 * 60 * 60));
      }
    }
  }

  return {
    topDestinations: [...destinationStats.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([destination, stats]) => ({
        destination,
        total_leads: stats.total,
        won_leads: stats.won,
      })),
    channelConversion: [...sourceStats.entries()]
      .map(([source, stats]) => ({
        source,
        total: stats.total,
        won: stats.won,
        conversion_rate: stats.total > 0 ? Number(((stats.won / stats.total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total - a.total),
    avgHoursToClose:
      closeDurations.length > 0
        ? Number(
            (closeDurations.reduce((sum, value) => sum + value, 0) / closeDurations.length).toFixed(2)
          )
        : null,
    lossReasons: inferLossReasons(leads),
    summary: "",
  };
}

function quoteMarkupPercent(row: GenericRow): number | null {
  const total = toNumber(row.total_amount) ?? toNumber(row.amount);
  const base =
    toNumber(row.base_amount) ??
    toNumber(row.net_amount) ??
    toNumber(toObject(row.metadata).pricing_subtotal);
  if (!total || !base || base <= 0 || total < base) return null;
  return Number((((total - base) / base) * 100).toFixed(2));
}

function quoteBaseCost(row: GenericRow): number {
  const base =
    toNumber(row.base_amount) ??
    toNumber(row.net_amount) ??
    toNumber(toObject(row.metadata).pricing_subtotal);
  if (base !== null && base > 0) return base;
  const total = toNumber(row.total_amount) ?? toNumber(row.amount) ?? 0;
  return total;
}

export async function buildRevenueOptimizerData(options?: {
  minMarginPercent?: number;
}): Promise<RevenueOptimizerData> {
  const minMarginPercent = Number.isFinite(options?.minMarginPercent ?? NaN)
    ? Math.max(0, Number(options?.minMarginPercent))
    : 8;

  const empty: RevenueOptimizerData = {
    hotLeads: [],
    quoteOpportunities: [],
    abandonedPayments: [],
    insights: {
      topDestinations: [],
      channelConversion: [],
      avgHoursToClose: null,
      lossReasons: [],
      summary: "",
    },
  };

  try {
    const db = new SupabaseRestClient();
    const [leads, quotes, bookings, payments, outreachLogs] = await Promise.all([
      fetchLeads(db),
      fetchQuotations(db),
      fetchBookings(db),
      fetchPayments(db),
      fetchRecentOutreachLogs(db),
    ]);

    const nowMs = Date.now();
    const leadById = new Map<string, GenericRow>();
    for (const lead of leads) {
      const id = normalizeLeadId(lead);
      if (id) leadById.set(id, lead);
    }

    const lastReminderByBooking = findLastReminderByBooking(outreachLogs);

    const hotLeads = toTop20(
      (leads
        .map((lead) => {
          const leadId = normalizeLeadId(lead);
          if (!leadId) return null;
          const stage = parseLeadStage(lead);
          if (!HOT_STAGES.has(stage)) return null;

          const budget = leadBudget(lead);
          if (budget === null || budget <= 0) return null;

          const outreach = getOutreachState(lead);
          if (outreach.doNotContact) return null;
          if (outreach.count >= 3) return null;

          const lastActivityMs = parseIsoMs(lead.updated_at) ?? parseIsoMs(lead.created_at);
          const inactivityHours = Number(hoursBetween(nowMs, lastActivityMs).toFixed(2));
          if (inactivityHours < 24) return null;

          return {
            lead_id: leadId,
            lead_code: safeString(lead.lead_code) || null,
            customer_name: leadCustomerName(lead),
            destination: destinationFromLead(lead),
            stage,
            budget: budget as number | null,
            inactivity_hours: inactivityHours,
            outreach_count: outreach.count,
            last_activity_at: safeString(lead.updated_at) || safeString(lead.created_at) || null,
            actions: [
              {
                type: "open_lead",
                label: "Open Lead",
                payload: { lead_id: leadId },
              },
              {
                type: "send_followup_now",
                label: "Send follow-up now",
                payload: { lead_id: leadId },
              },
            ] as RevenueAction[],
          } satisfies HotLeadItem;
        })
        .filter(Boolean) as HotLeadItem[])
        .sort((a, b) => b.inactivity_hours - a.inactivity_hours)
    );

    const quoteOpportunitiesRaw: QuoteOpportunityItem[] = [];
    for (const quote of quotes) {
      const status = safeString(quote.status).toLowerCase();
      if (status && status !== "sent" && status !== "quotation_sent" && status !== "approved") continue;
      const leadId = safeString(quote.lead_id);
      if (!leadId) continue;
      const lead = leadById.get(leadId);
      if (!lead) continue;
      const stage = parseLeadStage(lead);
      if (stage !== "quote_sent" && stage !== "negotiation" && stage !== "qualified") continue;

      const quoteId = normalizeQuoteId(quote);
      if (!quoteId) continue;

      const destination = destinationFromLead(lead);
      const quoteUpdatedMs = parseIsoMs(quote.updated_at) ?? parseIsoMs(quote.created_at);
      const stuckHours = Number(hoursBetween(nowMs, quoteUpdatedMs).toFixed(2));
      const currentMarkup = quoteMarkupPercent(quote);

      const baseCost = quoteBaseCost(quote);
      const pricing = await priceQuote(
        {
          base_cost: baseCost,
          destination,
          channel: safeString(lead.source).toLowerCase() === "b2b_agent" ? "agent" : "b2c",
          currency: safeString(quote.currency_code) || safeString(quote.currency) || "INR",
        },
        db
      );
      const recommendedMarkup =
        baseCost > 0 ? Number((((pricing.total - pricing.subtotal) / baseCost) * 100).toFixed(2)) : null;

      let suggestedDiscountPercent: number | null = null;
      let reason = "Markup aligned.";
      if (currentMarkup !== null && recommendedMarkup !== null) {
        if (currentMarkup > recommendedMarkup + 1 && stuckHours >= 48) {
          const targetMarkup = Math.max(minMarginPercent, recommendedMarkup);
          const discount = currentMarkup - targetMarkup;
          if (discount > 0.2) {
            suggestedDiscountPercent = Number(discount.toFixed(2));
            reason = `Quote is stuck ${Math.floor(stuckHours)}h with markup ${currentMarkup}%. Consider reducing by ${suggestedDiscountPercent}% while keeping floor margin ${minMarginPercent}%.`;
          } else {
            reason = `Quote is close to optimal markup. Focus on follow-up.`;
          }
        } else if (currentMarkup < recommendedMarkup - 1) {
          reason = `Quote markup ${currentMarkup}% is below recommended ${recommendedMarkup}%. Consider upsell or premium inclusions to improve profit.`;
        } else {
          reason = `Markup appears near recommended range.`;
        }
      } else if (stuckHours >= 48) {
        reason = `Quote is stale for ${Math.floor(stuckHours)}h. Recommend follow-up before adjusting price.`;
      }

      quoteOpportunitiesRaw.push({
        lead_id: leadId,
        lead_code: safeString(lead.lead_code) || null,
        quote_id: quoteId,
        quote_code: safeString(quote.quotation_code) || null,
        destination,
        quote_status: safeString(quote.status) || null,
        current_markup_percent: currentMarkup,
        recommended_markup_percent: recommendedMarkup,
        suggested_discount_percent: suggestedDiscountPercent,
        floor_margin_percent: minMarginPercent,
        reason,
        stuck_hours: stuckHours,
        actions: [
          {
            type: "open_quote",
            label: "Open Quote",
            payload: { lead_id: leadId, quote_id: quoteId },
          },
          {
            type: "recalc_quote",
            label: "Recalculate Quote",
            payload: { quote_id: quoteId, lead_id: leadId },
          },
          {
            type: "send_followup_now",
            label: "Send follow-up now",
            payload: { lead_id: leadId },
          },
        ],
      });
    }

    const quoteOpportunities = toTop20(
      quoteOpportunitiesRaw
        .sort((a, b) => b.stuck_hours - a.stuck_hours)
    );

    const bookingById = new Map<string, GenericRow>();
    for (const booking of bookings) {
      const id = safeString(booking.id);
      if (id) bookingById.set(id, booking);
    }

    const abandonedPayments = toTop20(
      (payments
        .map((payment) => {
          const paymentId = safeString(payment.id);
          const bookingId = safeString(payment.booking_id);
          if (!paymentId || !bookingId) return null;

          const booking = bookingById.get(bookingId);
          if (!booking) return null;
          const paymentStatus = safeString(booking.payment_status).toLowerCase();
          if (paymentStatus === "paid" || paymentStatus === "captured" || paymentStatus === "success") return null;

          const paymentLink = paymentLinkFromPayment(payment);
          if (!paymentLink) return null;

          const lastReminderAt = lastReminderByBooking.get(bookingId) || null;
          const reminderGapHours = Number(hoursBetween(nowMs, parseIsoMs(lastReminderAt)).toFixed(2));
          if (lastReminderAt && reminderGapHours < 6) return null;

          const leadId = safeString(booking.lead_id) || null;
          return {
            booking_id: bookingId,
            booking_code: safeString(booking.booking_code) || null,
            lead_id: leadId,
            payment_id: paymentId,
            amount: toNumber(payment.amount),
            currency: safeString(payment.currency_code) || safeString(payment.currency) || "INR",
            payment_status: safeString(payment.status) || null,
            payment_link: paymentLink,
            last_reminder_at: lastReminderAt,
            reminder_gap_hours: lastReminderAt ? reminderGapHours : null,
            suggestion:
              "Send reminder with payment link and offer call support. If still blocked, suggest split payment option.",
            actions: [
              {
                type: "open_quote",
                label: "Open Booking",
                payload: { booking_id: bookingId },
              },
              ...(leadId
                ? [
                    {
                      type: "send_followup_now" as const,
                      label: "Send follow-up now",
                      payload: { lead_id: leadId },
                    },
                  ]
                : []),
            ],
          } satisfies AbandonedPaymentItem;
        })
        .filter(Boolean) as AbandonedPaymentItem[])
        .sort((a, b) => {
          const aGap = a.reminder_gap_hours ?? 9999;
          const bGap = b.reminder_gap_hours ?? 9999;
          return bGap - aGap;
        })
    );

    return {
      hotLeads,
      quoteOpportunities,
      abandonedPayments,
      insights: buildInsights(leads, quotes, nowMs),
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return empty;
    return empty;
  }
}
