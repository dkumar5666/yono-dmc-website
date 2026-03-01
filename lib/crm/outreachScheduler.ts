import "server-only";

import { randomUUID } from "node:crypto";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { sendWhatsAppTemplate } from "@/lib/integrations/aisensy";
import { upsertContact } from "@/lib/integrations/mailchimp";
import { recordAutomationFailure } from "@/lib/system/automationFailures";
import { sanitizePhone } from "@/lib/leads/leadFingerprint";

type GenericRow = Record<string, unknown>;

export type OutreachType = "quote_followup" | "payment_reminder" | "reengagement";

export interface OutreachRunSummary {
  ok: boolean;
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  run_at: string;
}

export interface OutreachPreviewItem {
  lead_id: string;
  lead_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  destination: string | null;
  type: OutreachType;
  step: string;
  template: string;
  due_at: string;
  booking_id?: string | null;
  payment_link?: string | null;
}

export interface OutreachLogItem {
  id: string;
  lead_id: string | null;
  event: string;
  status: string;
  message: string;
  created_at: string | null;
  dedup_key: string | null;
  type: OutreachType | null;
  step: string | null;
}

export interface OutreachFailureItem {
  id: string;
  lead_id: string | null;
  booking_id: string | null;
  event: string;
  status: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OutreachDashboardData {
  upcoming: OutreachPreviewItem[];
  recent: OutreachLogItem[];
  failures: OutreachFailureItem[];
  summary: {
    scheduled: number;
    sent_last_24h: number;
    failures_open: number;
  };
}

interface LeadContext {
  id: string;
  leadCode: string | null;
  stage: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  destination: string | null;
  travelStart: string | null;
  travelEnd: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  metadata: Record<string, unknown>;
  doNotContact: boolean;
  outreachCount: number;
}

interface BookingContext {
  id: string;
  bookingCode: string | null;
  leadId: string | null;
  paymentStatus: string | null;
}

interface PaymentContext {
  id: string;
  bookingId: string | null;
  status: string | null;
  createdAt: string | null;
  paymentLink: string | null;
}

interface OutreachOpportunity {
  type: OutreachType;
  step: string;
  dedupKey: string;
  dueAtMs: number;
  dueAtIso: string;
  template: string;
  lead: LeadContext;
  booking: BookingContext | null;
  payment: PaymentContext | null;
}

const MAX_MESSAGES_PER_RUN = 50;
const MAX_MESSAGES_PER_LEAD_7D = 3;
const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;

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

function parseIso(value: string | null | undefined): number | null {
  const v = safeString(value);
  if (!v) return null;
  const ts = new Date(v).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function parseStage(status: string, metadata: Record<string, unknown>): string {
  const pipeline = safeString(metadata.pipeline_stage).toLowerCase();
  if (pipeline) return pipeline;
  const s = safeString(status).toLowerCase();
  if (s === "lead_created") return "new";
  if (s === "quotation_sent") return "quote_sent";
  return s || "new";
}

function inList(values: string[]): string {
  const escaped = values
    .map((v) => v.replace(/"/g, '\\"'))
    .map((v) => (/^[a-zA-Z0-9._:-]+$/.test(v) ? v : `"${v}"`));
  return `in.(${escaped.join(",")})`;
}

function dedupKey(type: OutreachType, leadId: string, step: string): string {
  return `crm_outreach:${type}:${leadId}:${step}`;
}

function resolveTemplate(step: string): string {
  const envMap: Record<string, string> = {
    quote_followup_1: safeString(process.env.CRM_WA_TEMPLATE_QUOTE_FOLLOWUP_1),
    quote_followup_2: safeString(process.env.CRM_WA_TEMPLATE_QUOTE_FOLLOWUP_2),
    quote_followup_3: safeString(process.env.CRM_WA_TEMPLATE_QUOTE_FOLLOWUP_3),
    payment_reminder_1: safeString(process.env.CRM_WA_TEMPLATE_PAYMENT_REMINDER_1),
    payment_reminder_2: safeString(process.env.CRM_WA_TEMPLATE_PAYMENT_REMINDER_2),
    payment_reminder_3: safeString(process.env.CRM_WA_TEMPLATE_PAYMENT_REMINDER_3),
    reengage_1: safeString(process.env.CRM_WA_TEMPLATE_REENGAGE_1),
  };
  return envMap[step] || step;
}

function parseOutreachType(value: string): OutreachType | null {
  if (value === "quote_followup" || value === "payment_reminder" || value === "reengagement") return value;
  return null;
}

function parseDedup(row: GenericRow): { key: string | null; type: OutreachType | null; step: string | null } {
  const meta = toObject(row.meta);
  const metadata = toObject(row.metadata);
  const key = safeString(row.dedup_key) || safeString(meta.dedup_key) || safeString(metadata.dedup_key) || null;
  if (!key) return { key: null, type: null, step: null };
  const parts = key.split(":");
  return {
    key,
    type: parts.length > 1 ? parseOutreachType(parts[1]) : null,
    step: parts.length > 3 ? parts.slice(3).join(":") : null,
  };
}

function paymentNeedsReminder(status: string | null): boolean {
  const s = safeString(status).toLowerCase();
  return s === "created" || s === "pending" || s === "authorized" || s === "requires_action";
}

function paymentIsPaid(status: string | null): boolean {
  const s = safeString(status).toLowerCase();
  return s === "paid" || s === "captured" || s === "success";
}

function paymentLinkFromRow(row: GenericRow): string | null {
  const rawPayload = toObject(row.raw_payload);
  const raw = toObject(row.raw);
  return (
    safeString(rawPayload.payment_url) ||
    safeString(rawPayload.payment_link_url) ||
    safeString(rawPayload.short_url) ||
    safeString(raw.payment_url) ||
    safeString(raw.payment_link_url) ||
    safeString(raw.short_url) ||
    null
  );
}

async function safeSelectMany<T>(db: SupabaseRestClient, table: string, query: URLSearchParams): Promise<T[]> {
  try {
    const rows = await db.selectMany<T>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function safeInsert(db: SupabaseRestClient, table: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await db.insertSingle(table, payload);
    return true;
  } catch {
    return false;
  }
}

async function safeUpdate(db: SupabaseRestClient, table: string, query: URLSearchParams, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await db.updateSingle(table, query, payload);
    return true;
  } catch {
    return false;
  }
}

function mapLead(row: GenericRow): LeadContext | null {
  const id = safeString(row.id);
  if (!id) return null;
  const metadata = toObject(row.metadata);
  const city = safeString(row.destination_city);
  const country = safeString(row.destination_country);
  return {
    id,
    leadCode: safeString(row.lead_code) || null,
    stage: parseStage(safeString(row.status), metadata),
    status: safeString(row.status),
    customerName: safeString(metadata.customer_name) || safeString(row.customer_name) || null,
    customerEmail: safeString(metadata.customer_email) || safeString(row.customer_email) || null,
    customerPhone: sanitizePhone(safeString(metadata.customer_phone) || safeString(row.customer_phone)) || null,
    destination: city && country ? `${city}, ${country}` : city || country || null,
    travelStart: safeString(row.travel_start_date) || null,
    travelEnd: safeString(row.travel_end_date) || null,
    updatedAt: safeString(row.updated_at) || null,
    createdAt: safeString(row.created_at) || null,
    metadata,
    doNotContact: Boolean(metadata.do_not_contact),
    outreachCount: Math.max(0, Math.floor(toNumber(metadata.outreach_count) ?? 0)),
  };
}

function mapBooking(row: GenericRow): BookingContext | null {
  const id = safeString(row.id);
  if (!id) return null;
  return {
    id,
    bookingCode: safeString(row.booking_code) || null,
    leadId: safeString(row.lead_id) || null,
    paymentStatus: safeString(row.payment_status) || null,
  };
}

function mapPayment(row: GenericRow): PaymentContext | null {
  const id = safeString(row.id);
  if (!id) return null;
  return {
    id,
    bookingId: safeString(row.booking_id) || null,
    status: safeString(row.status) || null,
    createdAt: safeString(row.created_at) || null,
    paymentLink: paymentLinkFromRow(row),
  };
}

async function loadLeads(db: SupabaseRestClient): Promise<LeadContext[]> {
  const rows = await safeSelectMany<GenericRow>(
    db,
    "leads",
    new URLSearchParams({
      select: "id,lead_code,status,source,destination_city,destination_country,travel_start_date,travel_end_date,customer_name,customer_email,customer_phone,metadata,updated_at,created_at",
      order: "updated_at.desc",
      limit: "600",
    })
  );
  return rows.map(mapLead).filter((lead): lead is LeadContext => Boolean(lead));
}

async function loadBookingsByLead(db: SupabaseRestClient, leadIds: string[]): Promise<BookingContext[]> {
  if (leadIds.length === 0) return [];
  const query = new URLSearchParams({
    select: "id,booking_code,lead_id,payment_status",
    order: "created_at.desc",
    limit: "600",
  });
  query.set("lead_id", inList(leadIds));
  const rows = await safeSelectMany<GenericRow>(db, "bookings", query);
  return rows.map(mapBooking).filter((row): row is BookingContext => Boolean(row));
}

async function loadPendingPayments(db: SupabaseRestClient): Promise<PaymentContext[]> {
  const since = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await safeSelectMany<GenericRow>(
    db,
    "payments",
    new URLSearchParams({
      select: "id,booking_id,status,created_at,raw_payload,raw",
      status: "in.(created,pending,authorized,requires_action)",
      created_at: `gte.${since}`,
      order: "created_at.desc",
      limit: "700",
    })
  );
  return rows.map(mapPayment).filter((row): row is PaymentContext => Boolean(row));
}

function buildOpportunities(leads: LeadContext[], bookings: BookingContext[], payments: PaymentContext[]): OutreachOpportunity[] {
  const opportunities: OutreachOpportunity[] = [];
  const bookingsByLead = new Map<string, BookingContext[]>();
  const bookingById = new Map<string, BookingContext>();

  for (const booking of bookings) {
    bookingById.set(booking.id, booking);
    const leadId = safeString(booking.leadId);
    if (!leadId) continue;
    const list = bookingsByLead.get(leadId) ?? [];
    list.push(booking);
    bookingsByLead.set(leadId, list);
  }

  const push = (lead: LeadContext, type: OutreachType, step: string, baseMs: number | null, delayMs: number, booking: BookingContext | null = null, payment: PaymentContext | null = null) => {
    if (!baseMs) return;
    const dueAtMs = baseMs + delayMs;
    opportunities.push({
      type,
      step,
      dedupKey: dedupKey(type, lead.id, step),
      dueAtMs,
      dueAtIso: new Date(dueAtMs).toISOString(),
      template: resolveTemplate(step),
      lead,
      booking,
      payment,
    });
  };

  for (const lead of leads) {
    if (lead.stage === "won" || lead.stage === "lost" || lead.doNotContact) continue;
    const leadBaseMs = parseIso(lead.updatedAt) ?? parseIso(lead.createdAt);

    if (lead.stage === "quote_sent") {
      push(lead, "quote_followup", "quote_followup_1", leadBaseMs, 2 * 60 * 60 * 1000);
      push(lead, "quote_followup", "quote_followup_2", leadBaseMs, 24 * 60 * 60 * 1000);
      push(lead, "quote_followup", "quote_followup_3", leadBaseMs, 72 * 60 * 60 * 1000);
    }

    if (lead.stage === "qualified") {
      push(lead, "reengagement", "reengage_1", leadBaseMs, 7 * 24 * 60 * 60 * 1000);
    }

    const leadBookings = bookingsByLead.get(lead.id) ?? [];
    const ids = new Set(leadBookings.map((item) => item.id));
    for (const payment of payments) {
      if (!payment.bookingId || !ids.has(payment.bookingId)) continue;
      if (!paymentNeedsReminder(payment.status)) continue;
      const booking = bookingById.get(payment.bookingId) ?? null;
      if (booking && paymentIsPaid(booking.paymentStatus)) continue;
      const baseMs = parseIso(payment.createdAt);
      push(lead, "payment_reminder", "payment_reminder_1", baseMs, 30 * 60 * 1000, booking, payment);
      push(lead, "payment_reminder", "payment_reminder_2", baseMs, 6 * 60 * 60 * 1000, booking, payment);
      push(lead, "payment_reminder", "payment_reminder_3", baseMs, 24 * 60 * 60 * 1000, booking, payment);
    }
  }

  opportunities.sort((a, b) => a.dueAtMs - b.dueAtMs);
  return opportunities;
}

async function readRecentOutreachState(db: SupabaseRestClient): Promise<{ dedup: Set<string>; sentCountByLead: Map<string, number> }> {
  const since = new Date(Date.now() - WINDOW_7D_MS).toISOString();
  const rows = await safeSelectMany<GenericRow>(
    db,
    "system_logs",
    new URLSearchParams({
      select: "id,event,entity_id,meta,metadata,created_at",
      event: "in.(crm_outreach_sent,crm_outreach_skipped,crm_outreach_failed,crm_outreach_reserved)",
      created_at: `gte.${since}`,
      order: "created_at.desc",
      limit: "1400",
    })
  );

  const dedup = new Set<string>();
  const sentCountByLead = new Map<string, number>();

  for (const row of rows) {
    const parsed = parseDedup(row);
    if (parsed.key) dedup.add(parsed.key);
    if (safeString(row.event) === "crm_outreach_sent") {
      const leadId = safeString(row.entity_id);
      if (!leadId) continue;
      sentCountByLead.set(leadId, (sentCountByLead.get(leadId) ?? 0) + 1);
    }
  }

  return { dedup, sentCountByLead };
}

async function writeLog(db: SupabaseRestClient, leadId: string, event: string, status: string, message: string, dedupValue: string, meta: Record<string, unknown>): Promise<void> {
  const payloads: Array<Record<string, unknown>> = [
    {
      level: status === "failed" ? "error" : "info",
      event,
      entity_type: "lead",
      entity_id: leadId,
      status,
      message,
      metadata: { ...meta, dedup_key: dedupValue },
    },
    {
      level: status === "failed" ? "error" : "info",
      event,
      entity_type: "lead",
      entity_id: leadId,
      status,
      message,
      meta: { ...meta, dedup_key: dedupValue },
    },
  ];

  for (const payload of payloads) {
    const ok = await safeInsert(db, "system_logs", payload);
    if (ok) return;
  }
}

async function updateLeadMetadata(db: SupabaseRestClient, lead: LeadContext): Promise<void> {
  const nextMetadata = {
    ...lead.metadata,
    last_outreach_at: new Date().toISOString(),
    outreach_count: lead.outreachCount + 1,
  };
  const ok = await safeUpdate(
    db,
    "leads",
    new URLSearchParams({ id: `eq.${lead.id}` }),
    { metadata: nextMetadata, updated_at: new Date().toISOString() }
  );
  if (!ok) {
    await writeLog(db, lead.id, "crm_outreach_meta_skipped", "skipped", "Lead outreach metadata update skipped", "", {});
  }
}

async function dispatchOutreach(db: SupabaseRestClient, item: OutreachOpportunity): Promise<{ sent: boolean; skipped: boolean; failed: boolean }> {
  const lead = item.lead;
  const typeTag = item.type === "payment_reminder" ? (safeString(process.env.MAILCHIMP_TAG_PAYMENT_REMINDER) || "PaymentReminderSent") : item.type === "reengagement" ? (safeString(process.env.MAILCHIMP_TAG_REENGAGED) || "Reengaged") : (safeString(process.env.MAILCHIMP_TAG_QUOTE_FOLLOWUP) || "QuoteFollowupSent");

  if (!lead.customerPhone) {
    await writeLog(db, lead.id, "crm_outreach_skipped", "skipped", "Outreach skipped: phone missing", item.dedupKey, { type: item.type, step: item.step });
    return { sent: false, skipped: true, failed: false };
  }

  if (!safeString(item.template)) {
    await writeLog(db, lead.id, "wa_template_missing", "skipped", "WhatsApp template missing", item.dedupKey, { type: item.type, step: item.step });
    return { sent: false, skipped: true, failed: false };
  }

  const wa = await sendWhatsAppTemplate({
    to: lead.customerPhone,
    template: item.template,
    variables: {
      name: lead.customerName || "Traveler",
      destination: lead.destination || "your trip",
      start_date: lead.travelStart || "",
      end_date: lead.travelEnd || "",
      lead_id: lead.leadCode || lead.id,
      payment_link: item.payment?.paymentLink || "",
      booking_id: item.booking?.bookingCode || item.booking?.id || "",
    },
  });

  if (!wa.ok) {
    await writeLog(db, lead.id, "crm_outreach_failed", "failed", "WhatsApp outreach failed", item.dedupKey, { type: item.type, step: item.step, error: wa.error || "wa_failed" });
    await recordAutomationFailure({
      bookingId: item.booking?.bookingCode || item.booking?.id || null,
      event: item.dedupKey,
      errorMessage: `outreach_whatsapp:${wa.error || "send_failed"}`,
      payload: { lead_id: lead.id, type: item.type, step: item.step },
    });
    return { sent: false, skipped: false, failed: true };
  }

  await writeLog(db, lead.id, "crm_outreach_sent", "success", "Outreach sent", item.dedupKey, { type: item.type, step: item.step, template: item.template });

  if (lead.customerEmail) {
    const mailchimp = await upsertContact({
      email: lead.customerEmail,
      phone: lead.customerPhone,
      name: lead.customerName,
      tags: [typeTag],
    });

    if (!mailchimp.ok && !mailchimp.skipped) {
      await writeLog(db, lead.id, "crm_outreach_mailchimp_failed", "failed", "Mailchimp tagging failed", item.dedupKey, { type: item.type, step: item.step, error: mailchimp.error || "tagging_failed" });
      await recordAutomationFailure({
        bookingId: item.booking?.bookingCode || item.booking?.id || null,
        event: item.dedupKey,
        errorMessage: `outreach_mailchimp:${mailchimp.error || "tagging_failed"}`,
        payload: { lead_id: lead.id, type: item.type, step: item.step },
      });
    }
  }

  await updateLeadMetadata(db, lead);
  return { sent: true, skipped: false, failed: false };
}

function firstDuePerType(opportunities: OutreachOpportunity[], dedup: Set<string>): OutreachOpportunity[] {
  const grouped = new Map<string, OutreachOpportunity[]>();
  for (const item of opportunities) {
    const key = `${item.lead.id}:${item.type}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  const selected: OutreachOpportunity[] = [];
  for (const list of grouped.values()) {
    const ordered = [...list].sort((a, b) => a.dueAtMs - b.dueAtMs);
    for (const item of ordered) {
      if (!dedup.has(item.dedupKey)) {
        selected.push(item);
        break;
      }
    }
  }

  return selected.sort((a, b) => a.dueAtMs - b.dueAtMs);
}

export async function runOutreachScheduler(): Promise<OutreachRunSummary> {
  const runAt = new Date().toISOString();
  try {
    const db = new SupabaseRestClient();
    const nowMs = Date.now();
    const leads = await loadLeads(db);
    const bookings = await loadBookingsByLead(db, leads.map((lead) => lead.id));
    const payments = await loadPendingPayments(db);
    const recentState = await readRecentOutreachState(db);
    const opportunities = firstDuePerType(buildOpportunities(leads, bookings, payments), recentState.dedup).filter(
      (item) => item.dueAtMs <= nowMs
    );
    let processed = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of opportunities) {
      if (processed >= MAX_MESSAGES_PER_RUN) break;
      processed += 1;

      const leadMessages = recentState.sentCountByLead.get(item.lead.id) ?? 0;
      if (item.lead.doNotContact) {
        skipped += 1;
        continue;
      }
      if (leadMessages >= MAX_MESSAGES_PER_LEAD_7D) {
        skipped += 1;
        await writeLog(db, item.lead.id, "crm_outreach_skipped", "skipped", "Outreach skipped due to throttling", item.dedupKey, { type: item.type, step: item.step });
        continue;
      }
      if (recentState.dedup.has(item.dedupKey)) {
        skipped += 1;
        continue;
      }

      await writeLog(db, item.lead.id, "crm_outreach_reserved", "info", "Outreach reserved", item.dedupKey, { type: item.type, step: item.step });
      recentState.dedup.add(item.dedupKey);

      const result = await dispatchOutreach(db, item);
      if (result.sent) {
        sent += 1;
        recentState.sentCountByLead.set(item.lead.id, leadMessages + 1);
      } else if (result.failed) {
        failed += 1;
      } else {
        skipped += 1;
      }
    }

    return { ok: true, processed, sent, skipped, failed, run_at: runAt };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { ok: false, processed: 0, sent: 0, skipped: 0, failed: 0, run_at: runAt };
    }
    return { ok: false, processed: 0, sent: 0, skipped: 0, failed: 0, run_at: runAt };
  }
}

export async function runLeadOutreachNow(leadRef: string): Promise<{ ok: boolean; sent: boolean; skipped: boolean; failed: boolean; reason?: string }> {
  const ref = safeString(leadRef);
  if (!ref) return { ok: false, sent: false, skipped: true, failed: false, reason: "invalid_lead" };

  try {
    const db = new SupabaseRestClient();
    const leadRows = await safeSelectMany<GenericRow>(
      db,
      "leads",
      new URLSearchParams({
        select: "id,lead_code,status,source,destination_city,destination_country,travel_start_date,travel_end_date,customer_name,customer_email,customer_phone,metadata,updated_at,created_at",
        or: `id.eq.${ref},lead_code.eq.${ref}`,
        limit: "2",
      })
    );
    const lead = leadRows.map(mapLead).find((row): row is LeadContext => Boolean(row)) ?? null;
    if (!lead) return { ok: false, sent: false, skipped: true, failed: false, reason: "lead_not_found" };

    const bookings = await loadBookingsByLead(db, [lead.id]);
    const payments = await loadPendingPayments(db);
    const state = await readRecentOutreachState(db);
    const next = firstDuePerType(buildOpportunities([lead], bookings, payments), state.dedup)[0] ?? null;
    if (!next) return { ok: true, sent: false, skipped: true, failed: false, reason: "no_eligible_step" };
    if (lead.doNotContact) return { ok: true, sent: false, skipped: true, failed: false, reason: "do_not_contact" };
    if ((state.sentCountByLead.get(lead.id) ?? 0) >= MAX_MESSAGES_PER_LEAD_7D) {
      return { ok: true, sent: false, skipped: true, failed: false, reason: "throttled" };
    }
    if (state.dedup.has(next.dedupKey)) return { ok: true, sent: false, skipped: true, failed: false, reason: "deduped" };

    await writeLog(db, lead.id, "crm_outreach_reserved", "info", "Manual outreach reserved", next.dedupKey, { type: next.type, step: next.step, manual: true });
    const result = await dispatchOutreach(db, next);
    return { ok: true, sent: result.sent, skipped: result.skipped, failed: result.failed, reason: result.failed ? "dispatch_failed" : result.skipped ? "skipped" : "sent" };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { ok: false, sent: false, skipped: true, failed: false, reason: "supabase_not_configured" };
    }
    return { ok: false, sent: false, skipped: false, failed: true, reason: "manual_outreach_failed" };
  }
}

export async function getOutreachDashboardData(): Promise<OutreachDashboardData> {
  try {
    const db = new SupabaseRestClient();
    const nowMs = Date.now();
    const leads = await loadLeads(db);
    const bookings = await loadBookingsByLead(db, leads.map((lead) => lead.id));
    const payments = await loadPendingPayments(db);
    const opportunities = firstDuePerType(buildOpportunities(leads, bookings, payments), (await readRecentOutreachState(db)).dedup);
    const state = await readRecentOutreachState(db);

    const upcoming: OutreachPreviewItem[] = opportunities
      .filter((item) => item.dueAtMs > nowMs && !item.lead.doNotContact && (state.sentCountByLead.get(item.lead.id) ?? 0) < MAX_MESSAGES_PER_LEAD_7D && !state.dedup.has(item.dedupKey))
      .slice(0, 80)
      .map((item) => ({
        lead_id: item.lead.id,
        lead_code: item.lead.leadCode,
        customer_name: item.lead.customerName,
        customer_phone: item.lead.customerPhone,
        destination: item.lead.destination,
        type: item.type,
        step: item.step,
        template: item.template,
        due_at: item.dueAtIso,
        booking_id: item.booking?.bookingCode || item.booking?.id || null,
        payment_link: item.payment?.paymentLink || null,
      }));

    const recentRows = await safeSelectMany<GenericRow>(
      db,
      "system_logs",
      new URLSearchParams({
        select: "id,event,status,level,message,entity_id,meta,metadata,created_at",
        event: "in.(crm_outreach_sent,crm_outreach_skipped,crm_outreach_failed,crm_outreach_mailchimp_failed,wa_template_missing)",
        order: "created_at.desc",
        limit: "140",
      })
    );
    const recent = recentRows.map((row) => {
      const parsed = parseDedup(row);
      return {
        id: safeString(row.id) || randomUUID(),
        lead_id: safeString(row.entity_id) || null,
        event: safeString(row.event) || "system_log",
        status: safeString(row.status) || safeString(row.level) || "info",
        message: safeString(row.message) || "Outreach log",
        created_at: safeString(row.created_at) || null,
        dedup_key: parsed.key,
        type: parsed.type,
        step: parsed.step,
      };
    });

    const failureRows = await safeSelectMany<GenericRow>(
      db,
      "automation_failures",
      new URLSearchParams({
        select: "id,booking_id,event,status,attempts,last_error,meta,created_at,updated_at",
        event: "like.crm_outreach:%",
        order: "created_at.desc",
        limit: "80",
      })
    );

    const failures: OutreachFailureItem[] = failureRows.map((row) => {
      const meta = toObject(row.meta);
      return {
        id: safeString(row.id) || randomUUID(),
        lead_id: safeString(meta.lead_id) || null,
        booking_id: safeString(row.booking_id) || null,
        event: safeString(row.event) || "crm_outreach",
        status: safeString(row.status) || null,
        attempts: Math.max(0, Math.floor(toNumber(row.attempts) ?? 0)),
        last_error: safeString(row.last_error) || null,
        created_at: safeString(row.created_at) || null,
        updated_at: safeString(row.updated_at) || null,
      };
    });

    const sentLast24h = recent.filter((row) => {
      if (row.event !== "crm_outreach_sent") return false;
      const ts = parseIso(row.created_at);
      return ts !== null && ts >= Date.now() - 24 * 60 * 60 * 1000;
    }).length;

    return {
      upcoming,
      recent,
      failures,
      summary: {
        scheduled: upcoming.length,
        sent_last_24h: sentLast24h,
        failures_open: failures.length,
      },
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { upcoming: [], recent: [], failures: [], summary: { scheduled: 0, sent_last_24h: 0, failures_open: 0 } };
    }
    return { upcoming: [], recent: [], failures: [], summary: { scheduled: 0, sent_last_24h: 0, failures_open: 0 } };
  }
}
