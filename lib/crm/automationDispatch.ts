import "server-only";

import { randomUUID } from "node:crypto";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { recordAutomationFailure } from "@/lib/system/automationFailures";
import { sendWhatsAppTemplate } from "@/lib/integrations/aisensy";
import { upsertContact } from "@/lib/integrations/mailchimp";
import { buildCrmAutomationDedupKey, reserveCrmAutomationDedup } from "@/lib/crm/automationDedup";
import { sanitizePhone } from "@/lib/leads/leadFingerprint";

type GenericRow = Record<string, unknown>;

export type CrmAutomationEvent =
  | "lead.created"
  | "lead.stage_changed"
  | "quote.sent"
  | "booking.won"
  | "payment.link_created";

export interface DispatchCrmAutomationInput {
  event: CrmAutomationEvent;
  leadId?: string;
  bookingId?: string;
  payload?: Record<string, unknown>;
}

export interface DispatchCrmAutomationResult {
  ok: boolean;
  deduped: boolean;
  lead_id: string;
  booking_id?: string;
  dedup_key: string;
  skipped_reason?: string;
  failures?: number;
}

interface LeadContext {
  id: string;
  leadCode: string | null;
  stage: string;
  status: string;
  destination: string | null;
  travelStart: string | null;
  travelEnd: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEvent(value: string): CrmAutomationEvent | null {
  if (
    value === "lead.created" ||
    value === "lead.stage_changed" ||
    value === "quote.sent" ||
    value === "booking.won" ||
    value === "payment.link_created"
  ) {
    return value;
  }
  return null;
}

function parseLeadStage(status: string, metadata: Record<string, unknown>): string {
  const pipeline = safeString(metadata.pipeline_stage).toLowerCase();
  if (pipeline) return pipeline;
  const normalizedStatus = status.toLowerCase();
  if (normalizedStatus === "quotation_sent") return "quote_sent";
  if (normalizedStatus === "lead_created") return "new";
  return normalizedStatus || "new";
}

function extractLeadContext(row: GenericRow): LeadContext | null {
  const id = safeString(row.id);
  if (!id) return null;
  const metadata = isRecord(row.metadata)
    ? row.metadata
    : isRecord(row.meta)
      ? row.meta
      : {};
  const destinationCity = safeString(row.destination_city);
  const destinationCountry = safeString(row.destination_country);
  const destination =
    destinationCity && destinationCountry
      ? `${destinationCity}, ${destinationCountry}`
      : destinationCity || destinationCountry || null;
  const status = safeString(row.status);

  return {
    id,
    leadCode: safeString(row.lead_code) || null,
    stage: parseLeadStage(status, metadata),
    status,
    destination,
    travelStart: safeString(row.travel_start_date) || null,
    travelEnd: safeString(row.travel_end_date) || null,
    customerName: safeString(metadata.customer_name) || safeString(row.customer_name) || null,
    customerEmail: safeString(metadata.customer_email) || safeString(row.customer_email) || null,
    customerPhone: sanitizePhone(safeString(metadata.customer_phone) || safeString(row.customer_phone)) || null,
    source: safeString(row.source) || null,
    metadata,
  };
}

async function safeSelectMany(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<GenericRow[] | null> {
  try {
    const rows = await db.selectMany<GenericRow>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return null;
  }
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

async function writeSystemLog(
  db: SupabaseRestClient,
  input: {
    leadId: string;
    event: string;
    status: "success" | "failed" | "skipped" | "info";
    message: string;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  const payloads: Array<Record<string, unknown>> = [
    {
      level: input.status === "failed" ? "error" : "info",
      event: input.event,
      entity_type: "lead",
      entity_id: input.leadId,
      status: input.status,
      message: input.message,
      metadata: input.meta ?? {},
    },
    {
      level: input.status === "failed" ? "error" : "info",
      event: input.event,
      entity_type: "lead",
      entity_id: input.leadId,
      status: input.status,
      message: input.message,
      meta: input.meta ?? {},
    },
    {
      event: input.event,
      message: input.message,
      meta: input.meta ?? {},
    },
  ];

  for (const payload of payloads) {
    const ok = await safeInsert(db, "system_logs", payload);
    if (ok) return;
  }
}

async function resolveLeadByRef(db: SupabaseRestClient, leadRef: string): Promise<LeadContext | null> {
  const ref = safeString(leadRef);
  if (!ref) return null;

  const byId = await safeSelectMany(
    db,
    "leads",
    new URLSearchParams({
      select: "*",
      id: `eq.${ref}`,
      limit: "1",
    })
  );
  const leadById = byId?.[0] ? extractLeadContext(byId[0]) : null;
  if (leadById) return leadById;

  const byCode = await safeSelectMany(
    db,
    "leads",
    new URLSearchParams({
      select: "*",
      lead_code: `eq.${ref}`,
      limit: "1",
    })
  );
  return byCode?.[0] ? extractLeadContext(byCode[0]) : null;
}

async function resolveLeadByBookingRef(db: SupabaseRestClient, bookingRef: string): Promise<LeadContext | null> {
  const ref = safeString(bookingRef);
  if (!ref) return null;

  const bookingByCode = await safeSelectMany(
    db,
    "bookings",
    new URLSearchParams({
      select: "id,lead_id,booking_code",
      booking_code: `eq.${ref}`,
      limit: "1",
    })
  );
  const bookingCodeMatch = bookingByCode?.[0];
  const leadIdFromCode = safeString(bookingCodeMatch?.lead_id);
  if (leadIdFromCode) {
    return resolveLeadByRef(db, leadIdFromCode);
  }

  const bookingById = await safeSelectMany(
    db,
    "bookings",
    new URLSearchParams({
      select: "id,lead_id,booking_code",
      id: `eq.${ref}`,
      limit: "1",
    })
  );
  const bookingIdMatch = bookingById?.[0];
  const leadIdFromId = safeString(bookingIdMatch?.lead_id);
  if (leadIdFromId) {
    return resolveLeadByRef(db, leadIdFromId);
  }

  return null;
}

function getMailchimpTags(event: CrmAutomationEvent, stage: string): string[] {
  const tags: string[] = [];
  const newLead = safeString(process.env.MAILCHIMP_TAG_NEW_LEAD) || "NewLead";
  const quoteSent = safeString(process.env.MAILCHIMP_TAG_QUOTE_SENT) || "QuoteSent";
  const won = safeString(process.env.MAILCHIMP_TAG_WON) || "Won";
  const paymentPending = safeString(process.env.MAILCHIMP_TAG_PAYMENT_PENDING) || "PaymentPending";

  if (event === "lead.created") tags.push(newLead);
  if (event === "quote.sent") tags.push(quoteSent);
  if (event === "booking.won") tags.push(won);
  if (event === "payment.link_created") tags.push(paymentPending);

  if (event === "lead.stage_changed" && stage === "quote_sent") tags.push(quoteSent);
  if (event === "lead.stage_changed" && stage === "won") tags.push(won);
  return Array.from(new Set(tags.filter(Boolean)));
}

function getWhatsAppTemplate(event: CrmAutomationEvent, stage: string): string {
  if (event === "lead.created") return "lead_received";
  if (event === "quote.sent") return "quote_sent";
  if (event === "booking.won") return "booking_won";
  if (event === "payment.link_created") return "payment_link_created";
  if (stage === "quote_sent") return "quote_sent";
  if (stage === "won") return "booking_won";
  return "lead_stage_updated";
}

async function createFollowupTask(
  db: SupabaseRestClient,
  args: {
    event: CrmAutomationEvent;
    lead: LeadContext;
    dedupKey: string;
  }
): Promise<{ ok: boolean; skipped: boolean; reason: string }> {
  const now = Date.now();
  let dueAt: string | null = null;
  let title = "";

  if (args.event === "lead.created") {
    dueAt = new Date(now + 15 * 60 * 1000).toISOString();
    title = "Call new lead";
  } else if (args.event === "quote.sent" || (args.event === "lead.stage_changed" && args.lead.stage === "quote_sent")) {
    dueAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    title = "Follow up on quote";
  } else if (args.event === "payment.link_created") {
    dueAt = new Date(now + 6 * 60 * 60 * 1000).toISOString();
    title = "Follow up on pending payment";
  } else {
    return { ok: true, skipped: true, reason: "not_required_for_event" };
  }

  const payloadVariants: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      lead_id: args.lead.id,
      title,
      status: "pending",
      due_at: dueAt,
      meta: {
        source: "crm_automation",
        dedup_key: args.dedupKey,
        event: args.event,
      },
    },
    {
      id: randomUUID(),
      entity_type: "lead",
      entity_id: args.lead.id,
      title,
      status: "pending",
      due_at: dueAt,
      metadata: {
        source: "crm_automation",
        dedup_key: args.dedupKey,
        event: args.event,
      },
    },
    {
      lead_id: args.lead.id,
      title,
      due_at: dueAt,
      status: "pending",
    },
  ];

  for (const payload of payloadVariants) {
    const ok = await safeInsert(db, "followups", payload);
    if (ok) return { ok: true, skipped: false, reason: "created" };
  }

  await writeSystemLog(db, {
    leadId: args.lead.id,
    event: "followup_suggested",
    status: "info",
    message: `Follow-up suggested: ${title}`,
    meta: {
      dedup_key: args.dedupKey,
      event: args.event,
      due_at: dueAt,
    },
  });
  return { ok: true, skipped: true, reason: "followups_table_unavailable" };
}

function getScopeValue(
  event: CrmAutomationEvent,
  lead: LeadContext,
  input: DispatchCrmAutomationInput
): string {
  if (event === "lead.stage_changed") {
    return lead.stage || lead.status || "stage_unknown";
  }
  if (event === "quote.sent") return "quote_sent";
  if (event === "booking.won") return "won";
  if (event === "payment.link_created") {
    const amountScope = safeString(input.payload?.amount);
    const bookingScope = safeString(input.bookingId) || "booking_unknown";
    return `payment_link:${bookingScope}:${amountScope || "na"}`;
  }
  return "created";
}

function hasAisensyConfig(): boolean {
  return Boolean(safeString(process.env.AISENSY_API_KEY));
}

function hasMailchimpConfig(): boolean {
  return Boolean(
    safeString(process.env.MAILCHIMP_API_KEY) &&
      safeString(process.env.MAILCHIMP_SERVER_PREFIX) &&
      safeString(process.env.MAILCHIMP_AUDIENCE_ID)
  );
}

export async function dispatchCrmAutomation(
  input: DispatchCrmAutomationInput
): Promise<DispatchCrmAutomationResult> {
  const event = normalizeEvent(input.event);
  const leadRef = safeString(input.leadId);
  const bookingRef = safeString(input.bookingId);
  if (!event || (!leadRef && !bookingRef)) {
    return {
      ok: false,
      deduped: false,
      lead_id: leadRef || "",
      booking_id: bookingRef || undefined,
      dedup_key: "",
      skipped_reason: "invalid_payload",
    };
  }

  try {
    const db = new SupabaseRestClient();
    let lead = leadRef ? await resolveLeadByRef(db, leadRef) : null;
    if (!lead && bookingRef) {
      lead = await resolveLeadByBookingRef(db, bookingRef);
    }
    if (!lead) {
      return {
        ok: false,
        deduped: false,
        lead_id: leadRef || "",
        booking_id: bookingRef || undefined,
        dedup_key: "",
        skipped_reason: "lead_not_found",
      };
    }

    const scopeValue = getScopeValue(event, lead, input);
    const dedupKey = buildCrmAutomationDedupKey({
      event,
      leadId: lead.id,
      scopeValue,
    });

    const dedup = await reserveCrmAutomationDedup(db, {
      dedupKey,
      event,
      leadId: lead.id,
      scopeValue,
    });

    if (!dedup.shouldRun) {
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "crm_auto_deduped",
        status: "skipped",
        message: "CRM automation skipped due to dedupe",
        meta: {
          dedup_key: dedupKey,
          crm_event: event,
          reason: dedup.reason,
          storage: dedup.storage,
        },
      });
      return {
        ok: true,
        deduped: true,
        lead_id: lead.id,
        booking_id: bookingRef || undefined,
        dedup_key: dedupKey,
        skipped_reason: "deduped",
      };
    }

    await writeSystemLog(db, {
      leadId: lead.id,
      event: "crm_auto_dispatch_started",
      status: "info",
      message: "CRM automation dispatch started",
      meta: {
        crm_event: event,
        dedup_key: dedupKey,
        stage: lead.stage,
        source: lead.source,
      },
    });

    let failures = 0;
    const bookingIdForLogs =
      bookingRef || safeString(input.payload?.booking_id) || undefined;
    const paymentUrlForMessage = safeString(input.payload?.payment_url);
    const paymentAmountForMessage = safeString(input.payload?.amount);
    const paymentCurrencyForMessage = safeString(input.payload?.currency).toUpperCase() || "INR";

    const template = getWhatsAppTemplate(event, lead.stage);
    if (!lead.customerPhone) {
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "wa_skipped_no_phone",
        status: "skipped",
        message: "WhatsApp send skipped: phone not available",
        meta: { dedup_key: dedupKey, crm_event: event },
      });
    } else if (!hasAisensyConfig()) {
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "wa_skipped_missing_config",
        status: "skipped",
        message: "WhatsApp send skipped: AiSensy not configured",
        meta: { dedup_key: dedupKey, crm_event: event },
      });
    } else {
      const waResult = await sendWhatsAppTemplate({
        to: lead.customerPhone,
        template,
        variables: {
          name: lead.customerName || "Traveler",
          destination: lead.destination || "your destination",
          start_date: lead.travelStart || "",
          end_date: lead.travelEnd || "",
          lead_id: lead.leadCode || lead.id,
          booking_id: bookingIdForLogs || "",
          payment_link: paymentUrlForMessage || "",
          amount: paymentAmountForMessage || "",
          currency: paymentCurrencyForMessage,
        },
      });

      if (waResult.ok) {
        await writeSystemLog(db, {
          leadId: lead.id,
          event: "wa_sent_success",
          status: "success",
          message: "WhatsApp confirmation sent",
          meta: {
            dedup_key: dedupKey,
            crm_event: event,
            template,
            status_code: waResult.status ?? null,
          },
        });
      } else {
        failures += 1;
        await writeSystemLog(db, {
          leadId: lead.id,
          event: waResult.skipped ? "wa_skipped" : "wa_failed",
          status: waResult.skipped ? "skipped" : "failed",
          message: waResult.skipped ? "WhatsApp skipped" : "WhatsApp send failed",
          meta: {
            dedup_key: dedupKey,
            crm_event: event,
            template,
            error: waResult.error ?? "wa_error",
            status_code: waResult.status ?? null,
          },
        });
        await recordAutomationFailure({
          bookingId: bookingIdForLogs ?? null,
          event: dedupKey,
          errorMessage: `whatsapp:${waResult.error ?? "send_failed"}`,
          payload: {
            lead_id: lead.id,
            booking_id: bookingIdForLogs ?? null,
            event,
            channel: "whatsapp",
            error: waResult.error ?? "send_failed",
          },
          meta: {
            dedup_key: dedupKey,
            status_code: waResult.status ?? null,
          },
        });
      }
    }

    const tags = getMailchimpTags(event, lead.stage);
    if (!lead.customerEmail) {
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "mailchimp_skipped_no_email",
        status: "skipped",
        message: "Mailchimp upsert skipped: email not available",
        meta: { dedup_key: dedupKey, crm_event: event, tags },
      });
    } else if (!hasMailchimpConfig()) {
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "mailchimp_skipped_missing_config",
        status: "skipped",
        message: "Mailchimp upsert skipped: config missing",
        meta: { dedup_key: dedupKey, crm_event: event, tags },
      });
    } else {
      const mailchimpResult = await upsertContact({
        email: lead.customerEmail,
        phone: lead.customerPhone,
        name: lead.customerName,
        tags,
      });

      if (mailchimpResult.ok) {
        await writeSystemLog(db, {
          leadId: lead.id,
          event: "mailchimp_upsert_success",
          status: "success",
          message: "Mailchimp contact updated",
          meta: {
            dedup_key: dedupKey,
            crm_event: event,
            tags,
          },
        });
      } else {
        failures += 1;
        await writeSystemLog(db, {
          leadId: lead.id,
          event: mailchimpResult.skipped ? "mailchimp_skipped" : "mailchimp_failed",
          status: mailchimpResult.skipped ? "skipped" : "failed",
          message: mailchimpResult.skipped ? "Mailchimp skipped" : "Mailchimp upsert failed",
          meta: {
            dedup_key: dedupKey,
            crm_event: event,
            tags,
            error: mailchimpResult.error ?? "mailchimp_error",
            status_code: mailchimpResult.status ?? null,
          },
        });
        await recordAutomationFailure({
          bookingId: bookingIdForLogs ?? null,
          event: dedupKey,
          errorMessage: `mailchimp:${mailchimpResult.error ?? "upsert_failed"}`,
          payload: {
            lead_id: lead.id,
            booking_id: bookingIdForLogs ?? null,
            event,
            channel: "mailchimp",
            error: mailchimpResult.error ?? "upsert_failed",
          },
          meta: {
            dedup_key: dedupKey,
            tags,
          },
        });
      }
    }

    const followupResult = await createFollowupTask(db, { event, lead, dedupKey });
    if (!followupResult.ok) {
      failures += 1;
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "followup_failed",
        status: "failed",
        message: "Follow-up task creation failed",
        meta: {
          dedup_key: dedupKey,
          crm_event: event,
          reason: followupResult.reason,
        },
      });
      await recordAutomationFailure({
        bookingId: bookingIdForLogs ?? null,
        event: dedupKey,
        errorMessage: "followup:create_failed",
        payload: {
          lead_id: lead.id,
          booking_id: bookingIdForLogs ?? null,
          event,
          channel: "followup",
          error: "create_failed",
        },
        meta: { dedup_key: dedupKey },
      });
    } else if (followupResult.skipped) {
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "followup_skipped",
        status: "skipped",
        message: "Follow-up not created",
        meta: {
          dedup_key: dedupKey,
          crm_event: event,
          reason: followupResult.reason,
        },
      });
    } else {
      await writeSystemLog(db, {
        leadId: lead.id,
        event: "followup_created",
        status: "success",
        message: "Follow-up task created",
        meta: {
          dedup_key: dedupKey,
          crm_event: event,
        },
      });
    }

    await writeSystemLog(db, {
      leadId: lead.id,
      event: "crm_auto_dispatch_completed",
      status: failures > 0 ? "failed" : "success",
      message: failures > 0 ? "CRM automation completed with failures" : "CRM automation completed",
      meta: {
        dedup_key: dedupKey,
        crm_event: event,
        failures,
      },
    });

    return {
      ok: true,
      deduped: false,
      lead_id: lead.id,
      booking_id: bookingIdForLogs,
      dedup_key: dedupKey,
      failures,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return {
        ok: false,
        deduped: false,
        lead_id: leadRef || "",
        booking_id: bookingRef || undefined,
        dedup_key: "",
        skipped_reason: "supabase_not_configured",
      };
    }
    return {
      ok: false,
      deduped: false,
      lead_id: leadRef || "",
      booking_id: bookingRef || undefined,
      dedup_key: "",
      skipped_reason: "dispatch_failed",
    };
  }
}

export async function triggerCrmAutomationBestEffort(
  input: DispatchCrmAutomationInput
): Promise<void> {
  try {
    await dispatchCrmAutomation(input);
  } catch {
    // best-effort by design
  }
}
