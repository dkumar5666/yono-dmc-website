import "server-only";

import { randomUUID } from "node:crypto";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";

type GenericRow = Record<string, unknown>;

export type CrmLeadStage = "new" | "qualified" | "quote_sent" | "negotiation" | "won" | "lost";

export interface CrmLeadListFilters {
  stage?: string;
  q?: string;
  source?: string;
  assigned_to?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface CrmLeadListRow {
  id: string | null;
  lead_id: string | null;
  lead_code: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  destination: string | null;
  destination_country: string | null;
  destination_city: string | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  budget: number | null;
  stage: CrmLeadStage;
  status: string | null;
  source: string | null;
  utm_campaign: string | null;
  assigned_to: string | null;
  booking_id: string | null;
  notes: string | null;
  requirements: string | null;
  do_not_contact: boolean;
  outreach_count: number;
  last_outreach_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CrmQuotationRow {
  id: string | null;
  quotation_id: string | null;
  quotation_code: string | null;
  status: string | null;
  total_amount: number | null;
  currency: string | null;
  booking_id: string | null;
  created_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CrmBookingSummary {
  id: string | null;
  booking_id: string | null;
  booking_code: string | null;
  lifecycle_status: string | null;
  payment_status: string | null;
  gross_amount: number | null;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CrmNoteRow {
  id: string;
  source: "lead_notes" | "system_logs";
  message: string;
  created_at: string | null;
  created_by: string | null;
  meta: Record<string, unknown> | null;
}

export interface CrmTimelineRow {
  id: string;
  event: string;
  status: string | null;
  message: string;
  created_at: string | null;
  source: "system_logs" | "booking_lifecycle_events" | "derived";
  meta: Record<string, unknown> | null;
}

export interface CrmAutomationRow {
  id: string;
  event: string;
  status: string | null;
  message: string;
  created_at: string | null;
  source: "system_logs";
  meta: Record<string, unknown> | null;
}

export interface CrmLeadDetail {
  lead: CrmLeadListRow | null;
  quotations: CrmQuotationRow[];
  booking: CrmBookingSummary | null;
  notes: CrmNoteRow[];
  timeline: CrmTimelineRow[];
  automations: CrmAutomationRow[];
  outreach_history: CrmAutomationRow[];
}

export interface CrmLeadPatchInput {
  stage?: string;
  assigned_to?: string;
  destination?: string;
  travel_start_date?: string;
  travel_end_date?: string;
  budget?: number | string | null;
  requirements?: string;
  do_not_contact?: boolean | null;
}

export interface CrmLeadNoteInput {
  message: string;
}

export interface CrmLeadCreateInput {
  source?: string;
  destination?: string;
  travel_start_date?: string;
  travel_end_date?: string;
  budget?: number | string | null;
  requirements?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

export interface CrmLeadConvertInput {
  quoteId?: string | null;
}

export interface CrmLeadConvertResult {
  ok: boolean;
  created: boolean;
  lead_id: string | null;
  quotation_id: string | null;
  booking_id: string | null;
  booking_code: string | null;
  error?: "lead_not_found" | "quote_not_found" | "customer_required" | "convert_failed";
}

const LEAD_STAGE_ORDER: CrmLeadStage[] = ["new", "qualified", "quote_sent", "negotiation", "won", "lost"];

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

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toDateIso(value: string | undefined): string | null {
  const v = safeString(value);
  if (!v) return null;
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseLimit(value?: number): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value?: number): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function maybeQuoted(value: string): string {
  return /^[a-z0-9-]+$/i.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}

function inList(values: string[]): string {
  return `in.(${values.map((v) => maybeQuoted(v)).join(",")})`;
}

function mapDbStatusToStage(status: string, metadata: Record<string, unknown> | null): CrmLeadStage {
  const dbStatus = safeString(status).toLowerCase();
  const pipelineStage = safeString(metadata?.pipeline_stage).toLowerCase();
  if (pipelineStage === "negotiation") return "negotiation";
  if (pipelineStage === "quote_sent") return "quote_sent";
  if (pipelineStage === "qualified") return "qualified";
  if (pipelineStage === "won") return "won";
  if (pipelineStage === "lost") return "lost";
  if (pipelineStage === "new") return "new";

  if (dbStatus === "lead_created") return "new";
  if (dbStatus === "qualified") return "qualified";
  if (dbStatus === "quotation_sent") return "quote_sent";
  if (dbStatus === "won") return "won";
  if (dbStatus === "lost" || dbStatus === "archived") return "lost";
  return "new";
}

function mapRequestedStageToDb(stage: string | undefined): {
  dbStatus: string | null;
  pipelineStage: CrmLeadStage | null;
} {
  const normalized = safeString(stage).toLowerCase();
  if (!normalized) return { dbStatus: null, pipelineStage: null };
  if (normalized === "new") return { dbStatus: "lead_created", pipelineStage: "new" };
  if (normalized === "qualified") return { dbStatus: "qualified", pipelineStage: "qualified" };
  if (normalized === "quote_sent") return { dbStatus: "quotation_sent", pipelineStage: "quote_sent" };
  if (normalized === "negotiation") return { dbStatus: "qualified", pipelineStage: "negotiation" };
  if (normalized === "won") return { dbStatus: "won", pipelineStage: "won" };
  if (normalized === "lost") return { dbStatus: "lost", pipelineStage: "lost" };
  return { dbStatus: null, pipelineStage: null };
}

function destinationLabel(country: string | null, city: string | null): string | null {
  const c = safeString(country);
  const ct = safeString(city);
  if (c && ct) return `${ct}, ${c}`;
  return ct || c || null;
}

function parseDestinationInput(value: string): { city: string | null; country: string | null } {
  const cleaned = safeString(value);
  if (!cleaned) return { city: null, country: null };
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts.slice(1).join(", ") };
  }
  return { city: cleaned, country: null };
}

function normalizeNameParts(fullName: string): { firstName: string; lastName: string | null } {
  const cleaned = safeString(fullName);
  if (!cleaned) return { firstName: "Traveler", lastName: null };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Traveler", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function buildCustomerCode(): string {
  const stamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `CUST-${stamp}-${random}`;
}

function buildBookingCode(): string {
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `BK-${yyyy}${mm}${dd}-${random}`;
}

function normalizeActorUuid(value: string | null | undefined): string | null {
  const candidate = safeString(value);
  return isUuidLike(candidate) ? candidate : null;
}

function mapLeadRow(
  row: GenericRow,
  customerMap: Map<string, GenericRow>,
  bookingMap: Map<string, CrmBookingSummary>
): CrmLeadListRow {
  const metadata = toObject(row.metadata);
  const id = safeString(row.id) || null;
  const leadCode = safeString(row.lead_code) || null;
  const customerId = safeString(row.customer_id) || null;
  const customer = customerId ? customerMap.get(customerId) : undefined;
  const customerName = customer
    ? `${safeString(customer.first_name)} ${safeString(customer.last_name)}`.trim() || safeString(customer.name) || null
    : safeString(metadata?.customer_name) || null;
  const booking = id ? bookingMap.get(id) : null;
  const destinationCountry = safeString(row.destination_country) || null;
  const destinationCity = safeString(row.destination_city) || null;
  const budgetFromMeta = toNumber(metadata?.budget);
  const budget = toNumber(row.budget) ?? budgetFromMeta;
  const outreachCount = Math.max(0, Math.floor(toNumber(metadata?.outreach_count) ?? 0));

  const utmData = toObject(metadata?.utm);
  const utmCampaign = safeString(utmData?.campaign) || safeString(metadata?.utm_campaign) || null;

  return {
    id,
    lead_id: leadCode || id,
    lead_code: leadCode,
    customer_id: customerId,
    customer_name: customerName,
    customer_email:
      safeString(customer?.email) || safeString(row.customer_email) || safeString(metadata?.customer_email) || null,
    customer_phone:
      safeString(customer?.phone) || safeString(row.customer_phone) || safeString(metadata?.customer_phone) || null,
    destination: destinationLabel(destinationCountry, destinationCity),
    destination_country: destinationCountry,
    destination_city: destinationCity,
    travel_start_date: safeString(row.travel_start_date) || null,
    travel_end_date: safeString(row.travel_end_date) || null,
    budget,
    stage: mapDbStatusToStage(safeString(row.status), metadata),
    status: safeString(row.status) || null,
    source: safeString(row.source) || null,
    utm_campaign: utmCampaign,
    assigned_to: safeString(row.assigned_to) || null,
    booking_id: booking?.booking_code || booking?.booking_id || null,
    notes: safeString(row.notes) || null,
    requirements: safeString(metadata?.requirements) || null,
    do_not_contact: Boolean(metadata?.do_not_contact),
    outreach_count: outreachCount,
    last_outreach_at: safeString(metadata?.last_outreach_at) || null,
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
    metadata,
  };
}

async function safeSelectMany(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<GenericRow[]> {
  try {
    const rows = await db.selectMany<GenericRow>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function safeSelectSingle(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<GenericRow | null> {
  try {
    return await db.selectSingle<GenericRow>(table, query);
  } catch {
    return null;
  }
}

async function safeInsert(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<GenericRow | null> {
  try {
    return await db.insertSingle<GenericRow>(table, payload);
  } catch {
    return null;
  }
}

async function safeUpdate(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams,
  payload: Record<string, unknown>
): Promise<GenericRow | null> {
  try {
    return await db.updateSingle<GenericRow>(table, query, payload);
  } catch {
    return null;
  }
}

async function selectManyWithFallback(
  db: SupabaseRestClient,
  table: string,
  variants: URLSearchParams[]
): Promise<GenericRow[]> {
  for (const query of variants) {
    const rows = await safeSelectMany(db, table, query);
    if (rows.length > 0) return rows;
  }
  return [];
}

async function resolveLeadRowByRef(db: SupabaseRestClient, leadRef: string): Promise<GenericRow | null> {
  const normalizedRef = safeString(leadRef);
  if (!normalizedRef) return null;

  const byCode = await safeSelectMany(
    db,
    "leads",
    new URLSearchParams({
      select: "*",
      lead_code: `eq.${normalizedRef}`,
      limit: "1",
    })
  );
  if (byCode.length > 0) return byCode[0];

  if (isUuidLike(normalizedRef)) {
    const byId = await safeSelectMany(
      db,
      "leads",
      new URLSearchParams({
        select: "*",
        id: `eq.${normalizedRef}`,
        limit: "1",
      })
    );
    if (byId.length > 0) return byId[0];
  }

  return null;
}

async function fetchCustomersByIds(db: SupabaseRestClient, ids: string[]): Promise<Map<string, GenericRow>> {
  if (ids.length === 0) return new Map();
  const rows = await safeSelectMany(
    db,
    "customers",
    new URLSearchParams({
      select: "*",
      id: inList(ids),
      limit: String(Math.max(ids.length, 1)),
    })
  );
  return new Map(
    rows
      .map((row) => [safeString(row.id), row] as const)
      .filter(([id]) => Boolean(id))
  );
}

async function fetchBookingsByLeadIds(
  db: SupabaseRestClient,
  leadIds: string[]
): Promise<Map<string, CrmBookingSummary>> {
  if (leadIds.length === 0) return new Map();

  const rows = await selectManyWithFallback(db, "bookings", [
    new URLSearchParams({
      select: "*",
      lead_id: inList(leadIds),
      order: "created_at.desc",
      limit: "500",
    }),
    new URLSearchParams({
      select: "*",
      lead_id: inList(leadIds),
      limit: "500",
    }),
  ]);

  const map = new Map<string, CrmBookingSummary>();
  for (const row of rows) {
    const leadId = safeString(row.lead_id);
    if (!leadId || map.has(leadId)) continue;
    const id = safeString(row.id) || null;
    map.set(leadId, {
      id,
      booking_id: safeString(row.booking_id) || safeString(row.booking_code) || id,
      booking_code: safeString(row.booking_code) || null,
      lifecycle_status: safeString(row.lifecycle_status) || null,
      payment_status: safeString(row.payment_status) || null,
      gross_amount: toNumber(row.gross_amount),
      currency: safeString(row.currency_code) || null,
      created_at: safeString(row.created_at) || null,
      updated_at: safeString(row.updated_at) || null,
    });
  }
  return map;
}

function withinDateRange(value: string | null, fromIso: string | null, toIso: string | null): boolean {
  if (!fromIso && !toIso) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (fromIso) {
    const fromDate = new Date(fromIso);
    if (!Number.isNaN(fromDate.getTime()) && date < fromDate) return false;
  }
  if (toIso) {
    const toDate = new Date(toIso);
    if (!Number.isNaN(toDate.getTime()) && date > toDate) return false;
  }
  return true;
}

function sortByUpdatedDesc(rows: CrmLeadListRow[]): CrmLeadListRow[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime() || 0;
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime() || 0;
    return bTime - aTime;
  });
}

export async function listAdminCrmLeads(filters: CrmLeadListFilters): Promise<{ rows: CrmLeadListRow[]; total: number }> {
  try {
    const db = new SupabaseRestClient();

    const leadRows = await selectManyWithFallback(db, "leads", [
      new URLSearchParams({
        select: "*",
        order: "updated_at.desc",
        limit: "800",
      }),
      new URLSearchParams({
        select: "*",
        order: "created_at.desc",
        limit: "800",
      }),
      new URLSearchParams({
        select: "*",
        limit: "800",
      }),
    ]);

    if (leadRows.length === 0) return { rows: [], total: 0 };

    const customerIds = Array.from(
      new Set(
        leadRows
          .map((row) => safeString(row.customer_id))
          .filter(Boolean)
      )
    );
    const leadIds = Array.from(
      new Set(
        leadRows
          .map((row) => safeString(row.id))
          .filter(Boolean)
      )
    );

    const [customerMap, bookingMap] = await Promise.all([
      fetchCustomersByIds(db, customerIds),
      fetchBookingsByLeadIds(db, leadIds),
    ]);

    const mapped = leadRows.map((row) => mapLeadRow(row, customerMap, bookingMap));
    const normalizedStage = safeString(filters.stage).toLowerCase();
    const normalizedSource = safeString(filters.source).toLowerCase();
    const normalizedAssignedTo = safeString(filters.assigned_to).toLowerCase();
    const normalizedSearch = safeString(filters.q).toLowerCase();
    const fromIso = toDateIso(filters.from);
    const toIso = toDateIso(filters.to ? `${filters.to}T23:59:59.999Z` : undefined);

    const filtered = mapped.filter((row) => {
      if (normalizedStage && normalizedStage !== "all" && row.stage !== normalizedStage) return false;
      if (normalizedSource && normalizedSource !== "all") {
        const src = safeString(row.source).toLowerCase();
        if (src !== normalizedSource) return false;
      }
      if (normalizedAssignedTo) {
        const assigned = safeString(row.assigned_to).toLowerCase();
        if (!assigned.includes(normalizedAssignedTo)) return false;
      }
      if (!withinDateRange(row.updated_at || row.created_at, fromIso, toIso)) return false;

      if (normalizedSearch) {
        const searchable = [
          safeString(row.lead_id),
          safeString(row.lead_code),
          safeString(row.customer_name),
          safeString(row.customer_email),
          safeString(row.customer_phone),
          safeString(row.destination),
          safeString(row.booking_id),
          safeString(row.source),
          safeString(row.utm_campaign),
          safeString(row.assigned_to),
          safeString(row.notes),
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(normalizedSearch)) return false;
      }
      return true;
    });

    const sorted = sortByUpdatedDesc(filtered);
    const total = sorted.length;
    const limit = parseLimit(filters.limit);
    const offset = parseOffset(filters.offset);
    return {
      rows: sorted.slice(offset, offset + limit),
      total,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { rows: [], total: 0 };
    return { rows: [], total: 0 };
  }
}

function mapQuotationRow(row: GenericRow): CrmQuotationRow {
  return {
    id: safeString(row.id) || null,
    quotation_id: safeString(row.quotation_id) || safeString(row.quotation_code) || safeString(row.id) || null,
    quotation_code: safeString(row.quotation_code) || null,
    status: safeString(row.status) || null,
    total_amount: toNumber(row.total_amount),
    currency: safeString(row.currency_code) || null,
    booking_id: safeString(row.booking_id) || null,
    created_at: safeString(row.created_at) || null,
    expires_at: safeString(row.expires_at) || null,
    metadata: toObject(row.metadata),
  };
}

async function fetchLeadNotes(
  db: SupabaseRestClient,
  lead: CrmLeadListRow
): Promise<CrmNoteRow[]> {
  if (!lead.id && !lead.lead_code) return [];
  const leadId = safeString(lead.id);
  const leadCode = safeString(lead.lead_code);

  const noteRows = await selectManyWithFallback(db, "lead_notes", [
    new URLSearchParams({
      select: "*",
      lead_id: `eq.${leadId}`,
      order: "created_at.desc",
      limit: "50",
    }),
    new URLSearchParams({
      select: "*",
      lead_id: `eq.${leadId}`,
      limit: "50",
    }),
  ]);

  if (noteRows.length > 0) {
    return noteRows.map((row) => ({
      id: safeString(row.id) || randomUUID(),
      source: "lead_notes",
      message: safeString(row.note) || safeString(row.message) || safeString(row.content) || "-",
      created_at: safeString(row.created_at) || null,
      created_by: safeString(row.created_by) || safeString(row.admin_id) || null,
      meta: toObject(row.meta),
    }));
  }

  const byEntity = await selectManyWithFallback(db, "system_logs", [
    new URLSearchParams({
      select: "*",
      entity_type: "eq.lead",
      entity_id: `eq.${leadId || leadCode}`,
      order: "created_at.desc",
      limit: "50",
    }),
    new URLSearchParams({
      select: "*",
      event: "eq.lead_note",
      order: "created_at.desc",
      limit: "50",
    }),
  ]);

  return byEntity
    .filter((row) => {
      const msg = safeString(row.message);
      const event = safeString(row.event);
      if (event === "lead_note") return true;
      return msg.length > 0 && safeString(row.entity_type).toLowerCase() === "lead";
    })
    .map((row) => ({
      id: safeString(row.id) || randomUUID(),
      source: "system_logs",
      message: safeString(row.message) || "-",
      created_at: safeString(row.created_at) || null,
      created_by: safeString(row.created_by) || safeString(row.admin_id) || null,
      meta: toObject(row.meta),
    }));
}

async function fetchLeadTimeline(
  db: SupabaseRestClient,
  lead: CrmLeadListRow,
  booking: CrmBookingSummary | null
): Promise<CrmTimelineRow[]> {
  const timeline: CrmTimelineRow[] = [];
  const leadRef = safeString(lead.id) || safeString(lead.lead_code);
  if (leadRef) {
    const systemLogs = await selectManyWithFallback(db, "system_logs", [
      new URLSearchParams({
        select: "*",
        entity_type: "eq.lead",
        entity_id: `eq.${leadRef}`,
        order: "created_at.desc",
        limit: "80",
      }),
      new URLSearchParams({
        select: "*",
        order: "created_at.desc",
        limit: "80",
      }),
    ]);

    for (const row of systemLogs) {
      const entityType = safeString(row.entity_type).toLowerCase();
      const entityId = safeString(row.entity_id);
      const message = safeString(row.message);
      if (entityType === "lead" && entityId && entityId !== leadRef) continue;
      if (!message && !safeString(row.event)) continue;
      timeline.push({
        id: safeString(row.id) || randomUUID(),
        event: safeString(row.event) || "system_log",
        status: safeString(row.status) || safeString(row.level) || null,
        message: message || "System update",
        created_at: safeString(row.created_at) || null,
        source: "system_logs",
        meta: toObject(row.meta),
      });
    }
  }

  const bookingId = safeString(booking?.id);
  if (bookingId) {
    const lifecycle = await selectManyWithFallback(db, "booking_lifecycle_events", [
      new URLSearchParams({
        select: "*",
        booking_id: `eq.${bookingId}`,
        order: "created_at.desc",
        limit: "50",
      }),
    ]);
    for (const row of lifecycle) {
      timeline.push({
        id: safeString(row.id) || randomUUID(),
        event: safeString(row.event_name) || safeString(row.to_status) || "lifecycle_event",
        status: safeString(row.to_status) || null,
        message: safeString(row.note) || "Booking lifecycle update",
        created_at: safeString(row.created_at) || null,
        source: "booking_lifecycle_events",
        meta: toObject(row.metadata),
      });
    }
  }

  if (timeline.length === 0) {
    timeline.push({
      id: `derived-${lead.id || lead.lead_code || "lead"}`,
      event: "lead_created",
      status: lead.status,
      message: "Lead record available.",
      created_at: lead.created_at,
      source: "derived",
      meta: null,
    });
  }

  return timeline.sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime() || 0;
    const bTime = new Date(b.created_at || 0).getTime() || 0;
    return bTime - aTime;
  });
}

function isAutomationEventName(event: string): boolean {
  const normalized = safeString(event).toLowerCase();
  return (
    normalized.startsWith("wa_") ||
    normalized.startsWith("mailchimp_") ||
    normalized.startsWith("followup_") ||
    normalized.startsWith("crm_auto_") ||
    normalized.startsWith("crm_outreach_")
  );
}

function inferAutomationStatus(row: GenericRow): string | null {
  const status = safeString(row.status);
  if (status) return status;
  const level = safeString(row.level).toLowerCase();
  if (level === "error") return "failed";
  if (level === "warn" || level === "warning") return "warn";
  if (level === "info") return "info";
  return null;
}

async function fetchLeadAutomationLogs(
  db: SupabaseRestClient,
  lead: CrmLeadListRow
): Promise<CrmAutomationRow[]> {
  const leadRef = safeString(lead.id) || safeString(lead.lead_code);
  if (!leadRef) return [];

  const rows = await selectManyWithFallback(db, "system_logs", [
    new URLSearchParams({
      select: "*",
      entity_type: "eq.lead",
      entity_id: `eq.${leadRef}`,
      order: "created_at.desc",
      limit: "200",
    }),
    new URLSearchParams({
      select: "*",
      order: "created_at.desc",
      limit: "400",
    }),
  ]);

  return rows
    .filter((row) => {
      const event = safeString(row.event);
      if (!isAutomationEventName(event)) return false;

      const entityType = safeString(row.entity_type).toLowerCase();
      const entityId = safeString(row.entity_id);
      if (entityType === "lead" && entityId && entityId !== leadRef) return false;
      return true;
    })
    .slice(0, 10)
    .map((row) => ({
      id: safeString(row.id) || randomUUID(),
      event: safeString(row.event) || "automation_event",
      status: inferAutomationStatus(row),
      message: safeString(row.message) || "Automation event",
      created_at: safeString(row.created_at) || null,
      source: "system_logs",
      meta: toObject(row.meta) ?? toObject(row.metadata),
    }));
}

async function fetchLeadOutreachHistory(
  db: SupabaseRestClient,
  lead: CrmLeadListRow
): Promise<CrmAutomationRow[]> {
  const leadRef = safeString(lead.id) || safeString(lead.lead_code);
  if (!leadRef) return [];

  const rows = await selectManyWithFallback(db, "system_logs", [
    new URLSearchParams({
      select: "*",
      entity_type: "eq.lead",
      entity_id: `eq.${leadRef}`,
      event: "in.(crm_outreach_sent,crm_outreach_skipped,crm_outreach_failed,crm_outreach_mailchimp_failed,crm_outreach_reserved,wa_template_missing)",
      order: "created_at.desc",
      limit: "40",
    }),
    new URLSearchParams({
      select: "*",
      entity_type: "eq.lead",
      entity_id: `eq.${leadRef}`,
      order: "created_at.desc",
      limit: "200",
    }),
  ]);

  return rows
    .filter((row) => {
      const event = safeString(row.event).toLowerCase();
      return (
        event.startsWith("crm_outreach_") ||
        event === "wa_template_missing" ||
        event === "crm_outreach_mailchimp_failed"
      );
    })
    .slice(0, 20)
    .map((row) => ({
      id: safeString(row.id) || randomUUID(),
      event: safeString(row.event) || "crm_outreach",
      status: inferAutomationStatus(row),
      message: safeString(row.message) || "Outreach event",
      created_at: safeString(row.created_at) || null,
      source: "system_logs",
      meta: toObject(row.meta) ?? toObject(row.metadata),
    }));
}

export async function getAdminCrmLeadDetail(leadRef: string): Promise<CrmLeadDetail> {
  try {
    const db = new SupabaseRestClient();
    const leadRow = await resolveLeadRowByRef(db, leadRef);
    if (!leadRow) {
      return { lead: null, quotations: [], booking: null, notes: [], timeline: [], automations: [], outreach_history: [] };
    }

    const leadId = safeString(leadRow.id);
    const customerId = safeString(leadRow.customer_id);
    const customerMap = await fetchCustomersByIds(db, customerId ? [customerId] : []);
    const bookingMap = await fetchBookingsByLeadIds(db, leadId ? [leadId] : []);
    const lead = mapLeadRow(leadRow, customerMap, bookingMap);

    const quotationRows = leadId
      ? await selectManyWithFallback(db, "quotations", [
          new URLSearchParams({
            select: "*",
            lead_id: `eq.${leadId}`,
            order: "created_at.desc",
            limit: "50",
          }),
          new URLSearchParams({
            select: "*",
            lead_id: `eq.${leadId}`,
            limit: "50",
          }),
        ])
      : [];
    const quotations = quotationRows.map(mapQuotationRow);

    let booking = bookingMap.get(leadId) ?? null;
    if (!booking) {
      const firstQuotationBookingId = quotations.find((q) => safeString(q.booking_id))?.booking_id;
      if (firstQuotationBookingId) {
        const bookingRows = await selectManyWithFallback(db, "bookings", [
          new URLSearchParams({
            select: "*",
            id: `eq.${firstQuotationBookingId}`,
            limit: "1",
          }),
        ]);
        if (bookingRows.length > 0) {
          const row = bookingRows[0];
          booking = {
            id: safeString(row.id) || null,
            booking_id: safeString(row.booking_code) || safeString(row.id) || null,
            booking_code: safeString(row.booking_code) || null,
            lifecycle_status: safeString(row.lifecycle_status) || null,
            payment_status: safeString(row.payment_status) || null,
            gross_amount: toNumber(row.gross_amount),
            currency: safeString(row.currency_code) || null,
            created_at: safeString(row.created_at) || null,
            updated_at: safeString(row.updated_at) || null,
          };
        }
      }
    }

    const [notes, timeline, automations, outreachHistory] = await Promise.all([
      fetchLeadNotes(db, lead),
      fetchLeadTimeline(db, lead, booking ?? null),
      fetchLeadAutomationLogs(db, lead),
      fetchLeadOutreachHistory(db, lead),
    ]);

    return {
      lead,
      quotations,
      booking: booking ?? null,
      notes,
      timeline,
      automations,
      outreach_history: outreachHistory,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { lead: null, quotations: [], booking: null, notes: [], timeline: [], automations: [], outreach_history: [] };
    }
    return { lead: null, quotations: [], booking: null, notes: [], timeline: [], automations: [], outreach_history: [] };
  }
}

export async function patchAdminCrmLead(
  leadRef: string,
  input: CrmLeadPatchInput,
  actor: { adminId?: string | null; username?: string | null }
): Promise<CrmLeadListRow | null> {
  try {
    const db = new SupabaseRestClient();
    const leadRow = await resolveLeadRowByRef(db, leadRef);
    if (!leadRow) return null;

    const leadId = safeString(leadRow.id);
    const existingMeta = toObject(leadRow.metadata) ?? {};
    const nextMeta: Record<string, unknown> = { ...existingMeta };

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const stageInfo = mapRequestedStageToDb(input.stage);
    if (stageInfo.dbStatus) payload.status = stageInfo.dbStatus;
    if (stageInfo.pipelineStage) nextMeta.pipeline_stage = stageInfo.pipelineStage;

    const assignedTo = safeString(input.assigned_to);
    if (assignedTo) payload.assigned_to = assignedTo;

    const destination = safeString(input.destination);
    if (destination) {
      const parsed = parseDestinationInput(destination);
      if (parsed.city) payload.destination_city = parsed.city;
      if (parsed.country) payload.destination_country = parsed.country;
      nextMeta.destination = destination;
    }

    if (input.travel_start_date !== undefined) {
      payload.travel_start_date = safeString(input.travel_start_date) || null;
    }
    if (input.travel_end_date !== undefined) {
      payload.travel_end_date = safeString(input.travel_end_date) || null;
    }

    const budget = toNumber(input.budget);
    if (budget !== null) nextMeta.budget = budget;

    const requirements = safeString(input.requirements);
    if (requirements) {
      nextMeta.requirements = requirements;
      payload.notes = requirements;
    }

    if (typeof input.do_not_contact === "boolean") {
      nextMeta.do_not_contact = input.do_not_contact;
    }

    payload.metadata = nextMeta;

    const variants: Array<Record<string, unknown>> = [
      payload,
      {
        status: payload.status,
        assigned_to: payload.assigned_to,
        destination_city: payload.destination_city,
        destination_country: payload.destination_country,
        travel_start_date: payload.travel_start_date,
        travel_end_date: payload.travel_end_date,
        notes: payload.notes,
        metadata: nextMeta,
        updated_at: payload.updated_at,
      },
      {
        status: payload.status,
        notes: payload.notes,
        metadata: nextMeta,
        updated_at: payload.updated_at,
      },
      {
        status: payload.status,
        updated_at: payload.updated_at,
      },
    ];

    let updatedRow: GenericRow | null = null;
    for (const variant of variants) {
      const cleaned = Object.fromEntries(
        Object.entries(variant).filter(([, value]) => value !== undefined)
      );
      if (Object.keys(cleaned).length === 0) continue;
      try {
        updatedRow = await db.updateSingle<GenericRow>(
          "leads",
          new URLSearchParams({
            id: `eq.${leadId}`,
          }),
          cleaned
        );
        if (updatedRow) break;
      } catch {
        // try smaller payload
      }
    }

    try {
      await writeAdminAuditLog(db, {
        adminId: actor.adminId ?? null,
        action: "crm_lead_updated",
        entityType: "lead",
        entityId: leadId,
        message: "CRM lead updated",
        meta: {
          actor_username: actor.username || null,
          updated_fields: Object.keys(payload).filter((key) => key !== "updated_at"),
          stage: stageInfo.pipelineStage || null,
        },
      });
    } catch {
      // audit fallback: do not fail patch
    }

    const finalRow = updatedRow ?? leadRow;
    const customerId = safeString(finalRow.customer_id);
    const [customerMap, bookingMap] = await Promise.all([
      fetchCustomersByIds(db, customerId ? [customerId] : []),
      fetchBookingsByLeadIds(db, leadId ? [leadId] : []),
    ]);
    return mapLeadRow(finalRow, customerMap, bookingMap);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

export async function addAdminCrmLeadNote(
  leadRef: string,
  input: CrmLeadNoteInput,
  actor: { adminId?: string | null; username?: string | null }
): Promise<{ ok: boolean }> {
  const message = safeString(input.message);
  if (!message) return { ok: false };

  try {
    const db = new SupabaseRestClient();
    const leadRow = await resolveLeadRowByRef(db, leadRef);
    if (!leadRow) return { ok: false };
    const leadId = safeString(leadRow.id);

    const leadNotePayloads: Array<Record<string, unknown>> = [
      {
        id: randomUUID(),
        lead_id: leadId,
        note: message,
        created_by: actor.adminId ?? null,
        meta: {
          source: "admin_crm",
          actor_username: actor.username || null,
        },
      },
      {
        id: randomUUID(),
        lead_id: leadId,
        message,
        created_by: actor.adminId ?? null,
        meta: {
          source: "admin_crm",
          actor_username: actor.username || null,
        },
      },
      {
        lead_id: leadId,
        content: message,
      },
    ];

    let inserted = false;
    for (const payload of leadNotePayloads) {
      try {
        await db.insertSingle<GenericRow>("lead_notes", payload);
        inserted = true;
        break;
      } catch {
        // fallback to next payload/table
      }
    }

    if (!inserted) {
      const systemLogPayloads: Array<Record<string, unknown>> = [
        {
          level: "info",
          event: "lead_note",
          entity_type: "lead",
          entity_id: leadId,
          message,
          meta: {
            source: "admin_crm",
            actor_user_id: actor.adminId ?? null,
            actor_username: actor.username || null,
          },
        },
        {
          event: "lead_note",
          message,
          meta: {
            entity_type: "lead",
            entity_id: leadId,
          },
        },
        {
          message,
        },
      ];

      for (const payload of systemLogPayloads) {
        try {
          await db.insertSingle<GenericRow>("system_logs", payload);
          inserted = true;
          break;
        } catch {
          // try next payload
        }
      }
    }

    try {
      await writeAdminAuditLog(db, {
        adminId: actor.adminId ?? null,
        action: "crm_lead_note_added",
        entityType: "lead",
        entityId: leadId,
        message: "Lead note added from CRM",
        meta: {
          actor_username: actor.username || null,
          note_length: message.length,
        },
      });
    } catch {
      // no-op
    }

    return { ok: inserted };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { ok: false };
    return { ok: false };
  }
}

export function crmLeadStageOptions(): CrmLeadStage[] {
  return [...LEAD_STAGE_ORDER];
}

export async function createAdminCrmLead(
  input: CrmLeadCreateInput,
  actor: { adminId?: string | null; username?: string | null }
): Promise<CrmLeadListRow | null> {
  try {
    const db = new SupabaseRestClient();
    const now = new Date();
    const timestamp = now.getTime();
    const leadCode = `LEAD-${timestamp}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    const source = safeString(input.source) || "manual_admin";
    const destination = safeString(input.destination);
    const { city, country } = parseDestinationInput(destination);
    const budget = toNumber(input.budget);

    const metadata: Record<string, unknown> = {
      pipeline_stage: "new",
      created_from: "admin_crm",
      actor_username: actor.username || null,
    };
    if (budget !== null) metadata.budget = budget;
    if (safeString(input.requirements)) metadata.requirements = safeString(input.requirements);
    if (safeString(input.customer_name)) metadata.customer_name = safeString(input.customer_name);
    if (safeString(input.customer_email)) metadata.customer_email = safeString(input.customer_email);
    if (safeString(input.customer_phone)) metadata.customer_phone = safeString(input.customer_phone);

    const basePayload: Record<string, unknown> = {
      id: randomUUID(),
      lead_code: leadCode,
      source,
      destination_country: country,
      destination_city: city,
      travel_start_date: safeString(input.travel_start_date) || null,
      travel_end_date: safeString(input.travel_end_date) || null,
      notes: safeString(input.requirements) || null,
      status: "lead_created",
      metadata,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const payloadVariants: Array<Record<string, unknown>> = [
      {
        ...basePayload,
        created_by: actor.adminId && isUuidLike(actor.adminId) ? actor.adminId : undefined,
        updated_by: actor.adminId && isUuidLike(actor.adminId) ? actor.adminId : undefined,
      },
      basePayload,
      {
        lead_code: leadCode,
        source,
        destination_country: country,
        destination_city: city,
        status: "lead_created",
        metadata,
      },
    ];

    let insertedLeadRow: GenericRow | null = null;
    for (const variant of payloadVariants) {
      const payload = Object.fromEntries(
        Object.entries(variant).filter(([, value]) => value !== undefined)
      );
      try {
        insertedLeadRow = await db.insertSingle<GenericRow>("leads", payload);
        if (insertedLeadRow) break;
      } catch {
        // try next payload variant
      }
    }

    if (!insertedLeadRow) return null;

    const insertedLeadId = safeString(insertedLeadRow.id);
    try {
      await writeAdminAuditLog(db, {
        adminId: actor.adminId ?? null,
        action: "crm_lead_created",
        entityType: "lead",
        entityId: insertedLeadId || leadCode,
        message: "CRM lead created",
        meta: {
          actor_username: actor.username || null,
          source,
          destination: destination || null,
        },
      });
    } catch {
      // no-op
    }

    const customerId = safeString(insertedLeadRow.customer_id);
    const [customerMap, bookingMap] = await Promise.all([
      fetchCustomersByIds(db, customerId ? [customerId] : []),
      fetchBookingsByLeadIds(db, insertedLeadId ? [insertedLeadId] : []),
    ]);
    return mapLeadRow(insertedLeadRow, customerMap, bookingMap);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

function mapBookingRef(row: GenericRow | null): {
  booking_id: string | null;
  booking_code: string | null;
} {
  if (!row) return { booking_id: null, booking_code: null };
  const bookingCode = safeString(row.booking_code) || null;
  const id = safeString(row.id) || null;
  return {
    booking_id: bookingCode || id,
    booking_code: bookingCode,
  };
}

function leadBudgetAmount(leadRow: GenericRow): number | null {
  const direct = toNumber(leadRow.budget);
  if (direct !== null) return direct;
  const metadata = toObject(leadRow.metadata);
  return toNumber(metadata?.budget) ?? toNumber(metadata?.budget_max) ?? null;
}

async function resolveQuotationForLeadConversion(
  db: SupabaseRestClient,
  leadId: string,
  quoteRef?: string | null
): Promise<GenericRow | null> {
  const normalizedQuoteRef = safeString(quoteRef);
  if (normalizedQuoteRef) {
    const byId = await safeSelectSingle(
      db,
      "quotations",
      new URLSearchParams({
        select: "*",
        id: `eq.${normalizedQuoteRef}`,
      })
    );
    if (byId && safeString(byId.lead_id) === leadId) return byId;

    const byCode = await safeSelectSingle(
      db,
      "quotations",
      new URLSearchParams({
        select: "*",
        quotation_code: `eq.${normalizedQuoteRef}`,
      })
    );
    if (byCode && safeString(byCode.lead_id) === leadId) return byCode;
    return null;
  }

  const rows = await safeSelectMany(
    db,
    "quotations",
    new URLSearchParams({
      select: "*",
      lead_id: `eq.${leadId}`,
      order: "created_at.desc",
      limit: "50",
    })
  );

  if (!rows.length) return null;
  const statusPriority: Record<string, number> = {
    approved: 0,
    sent: 1,
    draft: 2,
    rejected: 3,
    expired: 4,
  };

  return [...rows].sort((a, b) => {
    const aPriority = statusPriority[safeString(a.status).toLowerCase()] ?? 10;
    const bPriority = statusPriority[safeString(b.status).toLowerCase()] ?? 10;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aTime = new Date(safeString(a.created_at) || 0).getTime() || 0;
    const bTime = new Date(safeString(b.created_at) || 0).getTime() || 0;
    return bTime - aTime;
  })[0] ?? null;
}

async function resolveExistingBookingForLeadConversion(
  db: SupabaseRestClient,
  leadId: string,
  quotationRow: GenericRow | null
): Promise<GenericRow | null> {
  const quotationBookingId = safeString(quotationRow?.booking_id);
  if (quotationBookingId) {
    const byQuotationBookingId = await safeSelectSingle(
      db,
      "bookings",
      new URLSearchParams({
        select: "*",
        id: `eq.${quotationBookingId}`,
      })
    );
    if (byQuotationBookingId) return byQuotationBookingId;
  }

  const quotationId = safeString(quotationRow?.id);
  if (quotationId) {
    const byQuotation = await safeSelectMany(
      db,
      "bookings",
      new URLSearchParams({
        select: "*",
        quotation_id: `eq.${quotationId}`,
        order: "created_at.desc",
        limit: "1",
      })
    );
    if (byQuotation.length) return byQuotation[0];
  }

  const byLead = await safeSelectMany(
    db,
    "bookings",
    new URLSearchParams({
      select: "*",
      lead_id: `eq.${leadId}`,
      order: "created_at.desc",
      limit: "1",
    })
  );
  return byLead[0] ?? null;
}

function customerIdentityFromLead(leadRow: GenericRow): {
  name: string | null;
  email: string | null;
  phone: string | null;
} {
  const metadata = toObject(leadRow.metadata);
  return {
    name: safeString(metadata?.customer_name) || safeString(leadRow.customer_name) || null,
    email: safeString(metadata?.customer_email) || safeString(leadRow.customer_email) || null,
    phone: safeString(metadata?.customer_phone) || safeString(leadRow.customer_phone) || null,
  };
}

async function ensureLeadCustomerId(
  db: SupabaseRestClient,
  leadRow: GenericRow,
  actor: { adminId?: string | null; username?: string | null }
): Promise<string | null> {
  const existingCustomerId = safeString(leadRow.customer_id);
  if (existingCustomerId) return existingCustomerId;

  const identity = customerIdentityFromLead(leadRow);
  const email = safeString(identity.email);
  if (!email) return null;

  const nameParts = normalizeNameParts(identity.name || "Traveler");
  const actorId = normalizeActorUuid(actor.adminId);
  const metadata = {
    source: "crm_lead_conversion",
    lead_id: safeString(leadRow.id) || safeString(leadRow.lead_code) || null,
    actor_username: actor.username || null,
  };

  const payloadVariants: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      customer_code: buildCustomerCode(),
      first_name: nameParts.firstName,
      last_name: nameParts.lastName,
      email,
      phone: safeString(identity.phone) || null,
      preferred_currency: "INR",
      status: "active",
      metadata,
      created_by: actorId || undefined,
      updated_by: actorId || undefined,
    },
    {
      id: randomUUID(),
      customer_code: buildCustomerCode(),
      first_name: nameParts.firstName,
      last_name: nameParts.lastName,
      email,
      phone: safeString(identity.phone) || null,
      metadata,
    },
    {
      customer_code: buildCustomerCode(),
      first_name: nameParts.firstName,
      last_name: nameParts.lastName,
      email,
      phone: safeString(identity.phone) || null,
    },
  ];

  let insertedCustomer: GenericRow | null = null;
  for (const payload of payloadVariants) {
    insertedCustomer = await safeInsert(db, "customers", payload);
    if (insertedCustomer) break;
  }
  const insertedCustomerId = safeString(insertedCustomer?.id);
  if (!insertedCustomerId) return null;

  const leadId = safeString(leadRow.id);
  if (leadId) {
    const leadPatchVariants: Array<Record<string, unknown>> = [
      { customer_id: insertedCustomerId, updated_at: new Date().toISOString() },
      { customer_id: insertedCustomerId },
    ];

    for (const patch of leadPatchVariants) {
      const updated = await safeUpdate(
        db,
        "leads",
        new URLSearchParams({
          id: `eq.${leadId}`,
        }),
        patch
      );
      if (updated) break;
    }
  }

  return insertedCustomerId;
}

async function writeLeadConvertedSystemLog(
  db: SupabaseRestClient,
  input: {
    leadId: string;
    bookingId: string;
    quotationId: string | null;
    actorUsername: string | null;
  }
): Promise<void> {
  const variants: Array<Record<string, unknown>> = [
    {
      level: "info",
      event: "lead_converted_to_booking",
      entity_type: "lead",
      entity_id: input.leadId,
      message: "Lead converted to booking",
      metadata: {
        booking_id: input.bookingId,
        quotation_id: input.quotationId,
        actor_username: input.actorUsername,
      },
    },
    {
      level: "info",
      event: "lead_converted_to_booking",
      entity_type: "lead",
      entity_id: input.leadId,
      message: "Lead converted to booking",
      meta: {
        booking_id: input.bookingId,
        quotation_id: input.quotationId,
        actor_username: input.actorUsername,
      },
    },
    {
      event: "lead_converted_to_booking",
      message: "Lead converted to booking",
      meta: {
        lead_id: input.leadId,
        booking_id: input.bookingId,
      },
    },
  ];

  for (const payload of variants) {
    const inserted = await safeInsert(db, "system_logs", payload);
    if (inserted) return;
  }
}

export async function convertAdminCrmLeadToBooking(
  leadRef: string,
  input: CrmLeadConvertInput,
  actor: { adminId?: string | null; username?: string | null }
): Promise<CrmLeadConvertResult> {
  try {
    const db = new SupabaseRestClient();
    const leadRow = await resolveLeadRowByRef(db, leadRef);
    if (!leadRow) {
      return {
        ok: false,
        created: false,
        lead_id: null,
        quotation_id: null,
        booking_id: null,
        booking_code: null,
        error: "lead_not_found",
      };
    }

    const leadId = safeString(leadRow.id);
    if (!leadId) {
      return {
        ok: false,
        created: false,
        lead_id: null,
        quotation_id: null,
        booking_id: null,
        booking_code: null,
        error: "lead_not_found",
      };
    }

    const quotationRow = await resolveQuotationForLeadConversion(db, leadId, input.quoteId);
    if (!quotationRow) {
      return {
        ok: false,
        created: false,
        lead_id: leadId,
        quotation_id: null,
        booking_id: null,
        booking_code: null,
        error: "quote_not_found",
      };
    }

    const existing = await resolveExistingBookingForLeadConversion(db, leadId, quotationRow);
    if (existing) {
      const bookingRef = mapBookingRef(existing);
      return {
        ok: true,
        created: false,
        lead_id: leadId,
        quotation_id: safeString(quotationRow.id) || null,
        booking_id: bookingRef.booking_id,
        booking_code: bookingRef.booking_code,
      };
    }

    const customerId = await ensureLeadCustomerId(db, leadRow, actor);
    if (!customerId) {
      return {
        ok: false,
        created: false,
        lead_id: leadId,
        quotation_id: safeString(quotationRow.id) || null,
        booking_id: null,
        booking_code: null,
        error: "customer_required",
      };
    }

    const quotationId = safeString(quotationRow.id) || null;
    const actorId = normalizeActorUuid(actor.adminId);
    const amount =
      toNumber(quotationRow.total_amount) ??
      toNumber(quotationRow.amount) ??
      leadBudgetAmount(leadRow) ??
      0;
    const currency =
      safeString(quotationRow.currency_code) ||
      safeString(leadRow.currency_code) ||
      "INR";
    const travelStartDate = safeString(leadRow.travel_start_date) || null;
    const travelEndDate = safeString(leadRow.travel_end_date) || null;
    const leadMetadata = toObject(leadRow.metadata) ?? {};
    const quotationMetadata = toObject(quotationRow.metadata) ?? {};
    const nowIso = new Date().toISOString();

    const basePayload: Record<string, unknown> = {
      id: randomUUID(),
      booking_code: buildBookingCode(),
      customer_id: customerId,
      lead_id: leadId,
      quotation_id: quotationId,
      booking_channel: "admin",
      booking_mode: "dmc",
      lifecycle_status: "booking_created",
      payment_status: "payment_pending",
      supplier_status: "pending",
      currency_code: currency,
      gross_amount: amount,
      net_amount: amount,
      paid_amount: 0,
      due_amount: amount,
      refund_amount: 0,
      travel_start_date: travelStartDate,
      travel_end_date: travelEndDate,
      metadata: {
        source: "crm_conversion",
        lead_code: safeString(leadRow.lead_code) || null,
        quotation_code: safeString(quotationRow.quotation_code) || null,
        lead_metadata_snapshot: leadMetadata,
        quotation_metadata_snapshot: quotationMetadata,
      },
      created_at: nowIso,
      updated_at: nowIso,
      created_by: actorId || undefined,
      updated_by: actorId || undefined,
    };

    const payloadVariants: Array<Record<string, unknown>> = [
      basePayload,
      {
        ...basePayload,
        created_by: undefined,
        updated_by: undefined,
      },
      {
        booking_code: basePayload.booking_code,
        customer_id: customerId,
        lead_id: leadId,
        quotation_id: quotationId,
        lifecycle_status: "booking_created",
        payment_status: "payment_pending",
        supplier_status: "pending",
        currency_code: currency,
        gross_amount: amount,
        due_amount: amount,
      },
      {
        booking_code: basePayload.booking_code,
        customer_id: customerId,
        lead_id: leadId,
        quotation_id: quotationId,
      },
    ];

    let insertedBooking: GenericRow | null = null;
    for (const payload of payloadVariants) {
      insertedBooking = await safeInsert(
        db,
        "bookings",
        Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
      );
      if (insertedBooking) break;
    }

    if (!insertedBooking) {
      return {
        ok: false,
        created: false,
        lead_id: leadId,
        quotation_id: quotationId,
        booking_id: null,
        booking_code: null,
        error: "convert_failed",
      };
    }

    const insertedBookingId = safeString(insertedBooking.id);
    if (quotationId && insertedBookingId) {
      const quotePatchVariants: Array<Record<string, unknown>> = [
        {
          booking_id: insertedBookingId,
          status: "approved",
          updated_at: nowIso,
        },
        {
          booking_id: insertedBookingId,
          updated_at: nowIso,
        },
        {
          booking_id: insertedBookingId,
        },
      ];
      for (const patch of quotePatchVariants) {
        const updated = await safeUpdate(
          db,
          "quotations",
          new URLSearchParams({
            id: `eq.${quotationId}`,
          }),
          patch
        );
        if (updated) break;
      }
    }

    const bookingRef = mapBookingRef(insertedBooking);
    await writeLeadConvertedSystemLog(db, {
      leadId,
      bookingId: bookingRef.booking_id || insertedBookingId,
      quotationId,
      actorUsername: actor.username || null,
    });

    try {
      await writeAdminAuditLog(db, {
        adminId: actor.adminId ?? null,
        action: "convert_to_booking",
        entityType: "lead",
        entityId: leadId,
        message: "Lead converted to booking",
        meta: {
          booking_id: bookingRef.booking_id || insertedBookingId,
          quotation_id: quotationId,
          actor_username: actor.username || null,
        },
      });
    } catch {
      // audit fallback: safe by design
    }

    return {
      ok: true,
      created: true,
      lead_id: leadId,
      quotation_id: quotationId,
      booking_id: bookingRef.booking_id || insertedBookingId,
      booking_code: bookingRef.booking_code,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return {
        ok: false,
        created: false,
        lead_id: null,
        quotation_id: null,
        booking_id: null,
        booking_code: null,
        error: "convert_failed",
      };
    }
    return {
      ok: false,
      created: false,
      lead_id: null,
      quotation_id: null,
      booking_id: null,
      booking_code: null,
      error: "convert_failed",
    };
  }
}
