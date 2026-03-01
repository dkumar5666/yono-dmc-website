import "server-only";

import { randomUUID } from "node:crypto";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

type GenericRow = Record<string, unknown>;

export type AgentLeadStage = "new" | "qualified" | "quote_sent" | "negotiation" | "won" | "lost";

export interface AgentLeadListFilters {
  stage?: string;
  destination?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AgentLeadCreateInput {
  destination?: string;
  travel_start_date?: string;
  travel_end_date?: string;
  pax_adults?: number | string | null;
  pax_children?: number | string | null;
  budget?: number | string | null;
  requirements?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

export interface AgentLeadPatchInput {
  stage?: string;
}

export interface AgentLeadRow {
  id: string | null;
  lead_id: string | null;
  lead_code: string | null;
  stage: AgentLeadStage;
  status: string | null;
  source: string | null;
  destination: string | null;
  destination_city: string | null;
  destination_country: string | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  budget: number | null;
  requirements: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  assigned_to: string | null;
  booking_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  agent_id: string | null;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AgentQuoteRow {
  id: string | null;
  quotation_id: string | null;
  quotation_code: string | null;
  lead_id: string | null;
  booking_id: string | null;
  status: string | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string | null;
  expires_at: string | null;
  pdf_url: string | null;
  summary_url: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AgentBookingRow {
  id: string | null;
  booking_id: string | null;
  lead_id: string | null;
  quotation_id: string | null;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
  documents_count: number;
}

export interface AgentLeadDetail {
  lead: AgentLeadRow | null;
  quotations: AgentQuoteRow[];
  booking: AgentBookingRow | null;
  notes: Array<{
    id: string;
    message: string;
    created_at: string | null;
    created_by: string | null;
    source: "lead_notes" | "system_logs";
  }>;
}

export interface AgentBookingDetail {
  booking: AgentBookingRow | null;
  lead: AgentLeadRow | null;
  quotations: AgentQuoteRow[];
  payments: Array<{
    id: string | null;
    amount: number | null;
    currency: string | null;
    status: string | null;
    provider: string | null;
    payment_url: string | null;
    created_at: string | null;
  }>;
  documents: Array<{
    id: string | null;
    type: string | null;
    name: string | null;
    status: string | null;
    url: string | null;
    created_at: string | null;
  }>;
}

const LEAD_STAGE_ORDER: AgentLeadStage[] = ["new", "qualified", "quote_sent", "negotiation", "won", "lost"];
const EDITABLE_AGENT_STAGES = new Set<AgentLeadStage>(["new", "qualified", "negotiation", "lost"]);

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeLower(value: unknown): string {
  return safeString(value).toLowerCase();
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

function safeDate(value: string | null | undefined): Date | null {
  const text = safeString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function maybeQuoted(value: string): string {
  return /^[a-z0-9-]+$/i.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}

function inList(values: string[]): string {
  return `in.(${values.map((value) => maybeQuoted(value)).join(",")})`;
}

function mapDbStatusToStage(status: string, metadata: Record<string, unknown> | null): AgentLeadStage {
  const dbStatus = safeLower(status);
  const pipelineStage = safeLower(metadata?.pipeline_stage);
  if (pipelineStage === "new") return "new";
  if (pipelineStage === "qualified") return "qualified";
  if (pipelineStage === "quote_sent") return "quote_sent";
  if (pipelineStage === "negotiation") return "negotiation";
  if (pipelineStage === "won") return "won";
  if (pipelineStage === "lost") return "lost";

  if (dbStatus === "lead_created") return "new";
  if (dbStatus === "qualified") return "qualified";
  if (dbStatus === "quotation_sent") return "quote_sent";
  if (dbStatus === "won") return "won";
  if (dbStatus === "lost" || dbStatus === "archived") return "lost";
  return "new";
}

function mapRequestedStageToDb(stage: string | undefined): {
  dbStatus: string | null;
  pipelineStage: AgentLeadStage | null;
} {
  const normalized = safeLower(stage);
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
  if (ct && c) return `${ct}, ${c}`;
  return ct || c || null;
}

function parseDestinationInput(value: string): { city: string | null; country: string | null } {
  const cleaned = safeString(value);
  if (!cleaned) return { city: null, country: null };
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], country: parts.slice(1).join(", ") };
  }
  return { city: cleaned, country: null };
}

async function trySelectMany(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<{ ok: true; rows: GenericRow[] } | { ok: false; rows: [] }> {
  try {
    const rows = await db.selectMany<GenericRow>(table, query);
    return { ok: true, rows: Array.isArray(rows) ? rows : [] };
  } catch {
    return { ok: false, rows: [] };
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
    const result = await trySelectMany(db, table, query);
    if (!result.ok) continue;
    return result.rows;
  }
  return [];
}

function buildLeadSelectVariants(ownerFilter?: { key: string; value: string; limit?: number }): URLSearchParams[] {
  const selects = [
    "id,lead_code,agent_id,created_by,source,destination_country,destination_city,travel_start_date,travel_end_date,budget,status,assigned_to,booking_id,notes,requirements,customer_name,customer_email,customer_phone,metadata,created_at,updated_at",
    "id,lead_code,agent_id,created_by,source,destination_country,destination_city,travel_start_date,travel_end_date,budget,status,assigned_to,booking_id,notes,customer_name,customer_email,customer_phone,metadata,created_at,updated_at",
    "id,lead_code,created_by,source,destination_country,destination_city,travel_start_date,travel_end_date,budget,status,assigned_to,booking_id,notes,metadata,created_at,updated_at",
    "id,lead_code,source,destination_country,destination_city,travel_start_date,travel_end_date,budget,status,notes,metadata,created_at,updated_at",
  ];

  return selects.map((select) => {
    const query = new URLSearchParams({
      select,
      order: "updated_at.desc",
      limit: String(ownerFilter?.limit ?? 500),
    });
    if (ownerFilter) query.set(ownerFilter.key, ownerFilter.value);
    return query;
  });
}

function normalizeLeadRow(row: GenericRow): AgentLeadRow {
  const metadata = toObject(row.metadata) ?? toObject(row.meta);
  const destinationCountry = safeString(row.destination_country) || null;
  const destinationCity = safeString(row.destination_city) || null;
  const budget =
    toNumber(row.budget) ??
    toNumber(metadata?.budget) ??
    toNumber(metadata?.budget_max) ??
    null;
  const customerName = safeString(row.customer_name) || safeString(metadata?.customer_name) || null;
  const customerEmail = safeString(row.customer_email) || safeString(metadata?.customer_email) || null;
  const customerPhone = safeString(row.customer_phone) || safeString(metadata?.customer_phone) || null;
  const requirements = safeString(row.requirements) || safeString(metadata?.requirements) || safeString(row.notes) || null;
  const id = safeString(row.id) || null;
  const leadCode = safeString(row.lead_code) || null;
  const bookingId = safeString(row.booking_id) || safeString(metadata?.booking_id) || null;

  return {
    id,
    lead_id: leadCode || id,
    lead_code: leadCode,
    stage: mapDbStatusToStage(safeString(row.status), metadata),
    status: safeString(row.status) || null,
    source: safeString(row.source) || null,
    destination: destinationLabel(destinationCountry, destinationCity),
    destination_city: destinationCity,
    destination_country: destinationCountry,
    travel_start_date: safeString(row.travel_start_date) || null,
    travel_end_date: safeString(row.travel_end_date) || null,
    budget,
    requirements,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    assigned_to: safeString(row.assigned_to) || null,
    booking_id: bookingId,
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
    agent_id: safeString(row.agent_id) || safeString(metadata?.agent_id) || null,
    created_by: safeString(row.created_by) || null,
    metadata: metadata ?? null,
  };
}

function isOwnedLead(row: AgentLeadRow, userId: string): boolean {
  const normalizedUserId = safeString(userId);
  if (!normalizedUserId) return false;
  if (safeString(row.agent_id) && safeString(row.agent_id) === normalizedUserId) return true;
  if (safeString(row.created_by) && safeString(row.created_by) === normalizedUserId) return true;
  const metadataAgent = safeString(row.metadata?.agent_id);
  if (metadataAgent && metadataAgent === normalizedUserId) return true;
  return false;
}

function dedupeLeads(rows: AgentLeadRow[]): AgentLeadRow[] {
  const seen = new Set<string>();
  const out: AgentLeadRow[] = [];
  for (const row of rows) {
    const key = safeString(row.id) || safeString(row.lead_code) || safeString(row.lead_id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function fetchOwnedLeads(db: SupabaseRestClient, userId: string): Promise<AgentLeadRow[]> {
  const ownerQueries = [
    { key: "agent_id", value: `eq.${userId}` },
    { key: "created_by", value: `eq.${userId}` },
    { key: "metadata->>agent_id", value: `eq.${userId}` },
  ];

  const collected: AgentLeadRow[] = [];
  for (const ownerQuery of ownerQueries) {
    const rows = await selectManyWithFallback(db, "leads", buildLeadSelectVariants(ownerQuery));
    if (rows.length === 0) continue;
    collected.push(...rows.map(normalizeLeadRow).filter((row) => isOwnedLead(row, userId)));
  }

  if (collected.length > 0) {
    return dedupeLeads(collected).sort((a, b) => {
      const ta = safeDate(a.updated_at || a.created_at)?.getTime() ?? 0;
      const tb = safeDate(b.updated_at || b.created_at)?.getTime() ?? 0;
      return tb - ta;
    });
  }

  const recentRows = await selectManyWithFallback(db, "leads", buildLeadSelectVariants({ key: "id", value: "not.is.null", limit: 600 }));
  return dedupeLeads(recentRows.map(normalizeLeadRow).filter((row) => isOwnedLead(row, userId))).sort((a, b) => {
    const ta = safeDate(a.updated_at || a.created_at)?.getTime() ?? 0;
    const tb = safeDate(b.updated_at || b.created_at)?.getTime() ?? 0;
    return tb - ta;
  });
}

function filterLeads(rows: AgentLeadRow[], filters: AgentLeadListFilters): AgentLeadRow[] {
  const stageFilter = safeLower(filters.stage);
  const destinationFilter = safeLower(filters.destination);
  const search = safeLower(filters.q);
  const fromDate = safeDate(filters.from);
  const toDate = safeDate(filters.to);

  return rows.filter((row) => {
    if (stageFilter && stageFilter !== "all" && row.stage !== stageFilter) return false;
    if (destinationFilter) {
      const destination = safeLower(row.destination);
      if (!destination.includes(destinationFilter)) return false;
    }
    if (search) {
      const haystack = [
        safeString(row.lead_id),
        safeString(row.customer_name),
        safeString(row.customer_phone),
        safeString(row.customer_email),
        safeString(row.destination),
        safeString(row.booking_id),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    const time = safeDate(row.updated_at || row.created_at);
    if (fromDate && (!time || time.getTime() < fromDate.getTime())) return false;
    if (toDate && (!time || time.getTime() > toDate.getTime())) return false;
    return true;
  });
}

function mapQuoteRow(row: GenericRow): AgentQuoteRow {
  const metadata = toObject(row.metadata);
  return {
    id: safeString(row.id) || null,
    quotation_id: safeString(row.quotation_id) || safeString(row.quotation_code) || safeString(row.id) || null,
    quotation_code: safeString(row.quotation_code) || null,
    lead_id: safeString(row.lead_id) || null,
    booking_id: safeString(row.booking_id) || null,
    status: safeString(row.status) || null,
    total_amount: toNumber(row.total_amount) ?? toNumber(row.amount),
    currency: safeString(row.currency_code) || safeString(row.currency) || "INR",
    created_at: safeString(row.created_at) || null,
    expires_at: safeString(row.expires_at) || null,
    pdf_url:
      safeString(row.pdf_url) ||
      safeString(metadata?.pdf_url) ||
      safeString(metadata?.document_url) ||
      null,
    summary_url:
      safeString(row.summary_url) ||
      safeString(metadata?.summary_url) ||
      safeString(metadata?.url) ||
      null,
    metadata: metadata ?? null,
  };
}

function dedupeQuotes(rows: AgentQuoteRow[]): AgentQuoteRow[] {
  const seen = new Set<string>();
  const out: AgentQuoteRow[] = [];
  for (const row of rows) {
    const key = safeString(row.id) || safeString(row.quotation_code) || safeString(row.quotation_id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function mapBookingRow(row: GenericRow): AgentBookingRow {
  return {
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_code) || safeString(row.id) || null,
    lead_id: safeString(row.lead_id) || null,
    quotation_id: safeString(row.quotation_id) || null,
    status: safeString(row.lifecycle_status) || safeString(row.status) || null,
    payment_status: safeString(row.payment_status) || null,
    total_amount: toNumber(row.gross_amount) ?? toNumber(row.total_amount),
    currency: safeString(row.currency_code) || safeString(row.currency) || "INR",
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
    documents_count: 0,
  };
}

function dedupeBookings(rows: AgentBookingRow[]): AgentBookingRow[] {
  const seen = new Set<string>();
  const out: AgentBookingRow[] = [];
  for (const row of rows) {
    const key = safeString(row.id) || safeString(row.booking_id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function isQuoteForOwnedLead(row: AgentQuoteRow, leadRefs: Set<string>): boolean {
  const leadId = safeString(row.lead_id);
  return Boolean(leadId && leadRefs.has(leadId));
}

function isBookingOwned(
  row: AgentBookingRow,
  leadRefs: Set<string>,
  quoteRefs: Set<string>,
  leadBookingRefs: Set<string>
): boolean {
  const leadId = safeString(row.lead_id);
  if (leadId && leadRefs.has(leadId)) return true;
  const quotationId = safeString(row.quotation_id);
  if (quotationId && quoteRefs.has(quotationId)) return true;
  const bookingId = safeString(row.booking_id);
  const id = safeString(row.id);
  if (bookingId && leadBookingRefs.has(bookingId)) return true;
  if (id && leadBookingRefs.has(id)) return true;
  return false;
}
async function fetchQuotesForOwnedLeads(
  db: SupabaseRestClient,
  ownedLeads: AgentLeadRow[]
): Promise<AgentQuoteRow[]> {
  const leadRefs = Array.from(
    new Set(
      ownedLeads
        .flatMap((lead) => [safeString(lead.id), safeString(lead.lead_code), safeString(lead.lead_id)])
        .filter(Boolean)
    )
  );
  if (leadRefs.length === 0) return [];

  const selectVariants = [
    "id,quotation_id,quotation_code,lead_id,booking_id,status,total_amount,amount,currency_code,currency,created_at,expires_at,pdf_url,summary_url,metadata",
    "id,quotation_id,quotation_code,lead_id,booking_id,status,total_amount,amount,currency_code,currency,created_at,expires_at,metadata",
    "id,quotation_code,lead_id,booking_id,status,total_amount,currency_code,created_at,expires_at,metadata",
  ];

  const allRows: AgentQuoteRow[] = [];
  for (const select of selectVariants) {
    let rows: GenericRow[] = [];
    const chunks: string[][] = [];
    for (let i = 0; i < leadRefs.length; i += 100) chunks.push(leadRefs.slice(i, i + 100));
    for (const chunk of chunks) {
      const result = await trySelectMany(
        db,
        "quotations",
        new URLSearchParams({
          select,
          lead_id: inList(chunk),
          order: "created_at.desc",
          limit: "500",
        })
      );
      if (!result.ok) {
        rows = [];
        break;
      }
      rows.push(...result.rows);
    }
    if (rows.length === 0) continue;
    allRows.push(...rows.map(mapQuoteRow));
    break;
  }

  const leadRefSet = new Set(leadRefs);
  return dedupeQuotes(allRows).filter((row) => isQuoteForOwnedLead(row, leadRefSet));
}

async function fetchBookingsForOwnedLeads(
  db: SupabaseRestClient,
  ownedLeads: AgentLeadRow[],
  ownedQuotes: AgentQuoteRow[]
): Promise<AgentBookingRow[]> {
  const leadRefs = new Set(
    ownedLeads
      .flatMap((lead) => [safeString(lead.id), safeString(lead.lead_code), safeString(lead.lead_id)])
      .filter(Boolean)
  );
  const quoteRefs = new Set(
    ownedQuotes
      .flatMap((quote) => [safeString(quote.id), safeString(quote.quotation_id), safeString(quote.quotation_code)])
      .filter(Boolean)
  );
  const leadBookingRefs = new Set(
    ownedLeads.flatMap((lead) => [safeString(lead.booking_id)]).filter(Boolean)
  );

  const selectVariants = [
    "id,booking_code,lead_id,quotation_id,lifecycle_status,status,payment_status,gross_amount,total_amount,currency_code,currency,created_at,updated_at",
    "id,booking_code,lead_id,quotation_id,lifecycle_status,payment_status,gross_amount,currency_code,created_at,updated_at",
    "id,booking_code,lead_id,quotation_id,status,payment_status,total_amount,currency,created_at,updated_at",
  ];

  const collected: AgentBookingRow[] = [];
  for (const select of selectVariants) {
    let variantWorked = false;

    const leadIds = Array.from(leadRefs);
    for (let i = 0; i < leadIds.length; i += 100) {
      const chunk = leadIds.slice(i, i + 100);
      const result = await trySelectMany(
        db,
        "bookings",
        new URLSearchParams({
          select,
          lead_id: inList(chunk),
          order: "created_at.desc",
          limit: "600",
        })
      );
      if (!result.ok) continue;
      variantWorked = true;
      collected.push(...result.rows.map(mapBookingRow));
    }

    const quoteIds = Array.from(quoteRefs);
    for (let i = 0; i < quoteIds.length; i += 100) {
      const chunk = quoteIds.slice(i, i + 100);
      const result = await trySelectMany(
        db,
        "bookings",
        new URLSearchParams({
          select,
          quotation_id: inList(chunk),
          order: "created_at.desc",
          limit: "600",
        })
      );
      if (!result.ok) continue;
      variantWorked = true;
      collected.push(...result.rows.map(mapBookingRow));
    }

    if (variantWorked) break;
  }

  if (collected.length === 0 && leadBookingRefs.size > 0) {
    for (const bookingRef of leadBookingRefs) {
      for (const select of selectVariants) {
        const byCode = await trySelectMany(
          db,
          "bookings",
          new URLSearchParams({
            select,
            booking_code: `eq.${bookingRef}`,
            limit: "1",
          })
        );
        if (byCode.ok && byCode.rows.length > 0) {
          collected.push(...byCode.rows.map(mapBookingRow));
          break;
        }
        const byId = await trySelectMany(
          db,
          "bookings",
          new URLSearchParams({
            select,
            id: `eq.${bookingRef}`,
            limit: "1",
          })
        );
        if (byId.ok && byId.rows.length > 0) {
          collected.push(...byId.rows.map(mapBookingRow));
          break;
        }
      }
    }
  }

  return dedupeBookings(collected).filter((row) =>
    isBookingOwned(row, leadRefs, quoteRefs, leadBookingRefs)
  );
}

async function fetchDocumentsCountByBooking(
  db: SupabaseRestClient,
  bookingRows: AgentBookingRow[]
): Promise<Map<string, number>> {
  const bookingRefs = Array.from(
    new Set(
      bookingRows.flatMap((row) => [safeString(row.id), safeString(row.booking_id)]).filter(Boolean)
    )
  );
  if (bookingRefs.length === 0) return new Map<string, number>();

  const counts = new Map<string, number>();
  for (let i = 0; i < bookingRefs.length; i += 100) {
    const chunk = bookingRefs.slice(i, i + 100);
    const result = await trySelectMany(
      db,
      "documents",
      new URLSearchParams({
        select: "booking_id,id",
        booking_id: inList(chunk),
        limit: "2000",
      })
    );
    if (!result.ok) continue;
    for (const row of result.rows) {
      const key = safeString(row.booking_id);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function applyDocumentsCount(
  rows: AgentBookingRow[],
  counts: Map<string, number>
): AgentBookingRow[] {
  return rows.map((row) => {
    const byId = safeString(row.id);
    const byCode = safeString(row.booking_id);
    const count = (byId ? counts.get(byId) : undefined) ?? (byCode ? counts.get(byCode) : undefined) ?? 0;
    return {
      ...row,
      documents_count: count,
    };
  });
}

async function writeSystemLog(
  db: SupabaseRestClient,
  input: {
    event: string;
    entityId: string;
    message: string;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  const payloads: Array<Record<string, unknown>> = [
    {
      level: "info",
      event: input.event,
      entity_type: "lead",
      entity_id: input.entityId,
      message: input.message,
      metadata: input.meta ?? {},
    },
    {
      level: "info",
      event: input.event,
      entity_type: "lead",
      entity_id: input.entityId,
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
    const inserted = await safeInsert(db, "system_logs", payload);
    if (inserted) return;
  }
}

export async function listAgentLeads(
  userId: string,
  filters: AgentLeadListFilters
): Promise<{ rows: AgentLeadRow[]; total: number }> {
  try {
    const db = new SupabaseRestClient();
    const ownedLeads = await fetchOwnedLeads(db, userId);
    const filtered = filterLeads(ownedLeads, filters);
    const limit = parseLimit(filters.limit);
    const offset = parseOffset(filters.offset);
    return {
      rows: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { rows: [], total: 0 };
    return { rows: [], total: 0 };
  }
}

export async function createAgentLead(
  userId: string,
  input: AgentLeadCreateInput
): Promise<AgentLeadRow | null> {
  const destination = safeString(input.destination);
  if (!destination) return null;

  try {
    const db = new SupabaseRestClient();
    const nowIso = new Date().toISOString();
    const leadCode = `AGENT-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
    const { city, country } = parseDestinationInput(destination);
    const budget = toNumber(input.budget);
    const metadata: Record<string, unknown> = {
      pipeline_stage: "new",
      source: "b2b_agent",
      agent_id: userId,
      customer_name: safeString(input.customer_name) || null,
      customer_email: safeString(input.customer_email) || null,
      customer_phone: safeString(input.customer_phone) || null,
      requirements: safeString(input.requirements) || null,
      agent_commission_percent: null,
      pax_adults: toNumber(input.pax_adults),
      pax_children: toNumber(input.pax_children),
    };
    if (budget !== null) metadata.budget = budget;

    const payloadVariants: Array<Record<string, unknown>> = [
      {
        id: randomUUID(),
        lead_code: leadCode,
        agent_id: userId,
        created_by: userId,
        source: "b2b_agent",
        destination_country: country,
        destination_city: city,
        travel_start_date: safeString(input.travel_start_date) || null,
        travel_end_date: safeString(input.travel_end_date) || null,
        budget,
        notes: safeString(input.requirements) || null,
        requirements: safeString(input.requirements) || null,
        customer_name: safeString(input.customer_name) || null,
        customer_email: safeString(input.customer_email) || null,
        customer_phone: safeString(input.customer_phone) || null,
        status: "lead_created",
        metadata,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: randomUUID(),
        lead_code: leadCode,
        created_by: userId,
        source: "b2b_agent",
        destination_country: country,
        destination_city: city,
        travel_start_date: safeString(input.travel_start_date) || null,
        travel_end_date: safeString(input.travel_end_date) || null,
        notes: safeString(input.requirements) || null,
        status: "lead_created",
        metadata,
      },
      {
        id: randomUUID(),
        lead_code: leadCode,
        source: "b2b_agent",
        destination_country: country,
        destination_city: city,
        status: "lead_created",
        metadata,
      },
      {
        lead_code: leadCode,
        source: "b2b_agent",
        destination_country: country,
        destination_city: city,
        status: "lead_created",
        metadata,
      },
    ];

    let inserted: GenericRow | null = null;
    for (const payload of payloadVariants) {
      inserted = await safeInsert(
        db,
        "leads",
        Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
      );
      if (inserted) break;
    }
    if (!inserted) return null;

    const mapped = normalizeLeadRow(inserted);
    if (!isOwnedLead(mapped, userId)) {
      if (mapped.id) {
        await safeUpdate(
          db,
          "leads",
          new URLSearchParams({ id: `eq.${mapped.id}` }),
          {
            metadata: {
              ...(mapped.metadata ?? {}),
              agent_id: userId,
            },
          }
        );
      }
    }

    await writeSystemLog(db, {
      event: "lead_created",
      entityId: safeString(mapped.id) || safeString(mapped.lead_code) || safeString(mapped.lead_id),
      message: "Lead created from B2B agent portal",
      meta: {
        source: "b2b_agent",
        agent_id: userId,
      },
    });

    return mapped;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}
async function resolveOwnedLeadByRef(
  db: SupabaseRestClient,
  userId: string,
  leadRef: string
): Promise<AgentLeadRow | null> {
  const ref = safeString(leadRef);
  if (!ref) return null;

  const queries = [
    ...buildLeadSelectVariants({ key: "id", value: `eq.${ref}`, limit: 1 }),
    ...buildLeadSelectVariants({ key: "lead_code", value: `eq.${ref}`, limit: 1 }),
  ];

  for (const query of queries) {
    const result = await trySelectMany(db, "leads", query);
    if (!result.ok || result.rows.length === 0) continue;
    const row = normalizeLeadRow(result.rows[0]);
    if (isOwnedLead(row, userId)) return row;
  }

  const leads = await fetchOwnedLeads(db, userId);
  return (
    leads.find((lead) => safeString(lead.id) === ref) ??
    leads.find((lead) => safeString(lead.lead_code) === ref) ??
    leads.find((lead) => safeString(lead.lead_id) === ref) ??
    null
  );
}

async function fetchLeadNotes(db: SupabaseRestClient, lead: AgentLeadRow): Promise<AgentLeadDetail["notes"]> {
  const leadId = safeString(lead.id);
  const leadCode = safeString(lead.lead_code);
  if (!leadId && !leadCode) return [];

  const leadNotes = await selectManyWithFallback(db, "lead_notes", [
    new URLSearchParams({
      select: "id,lead_id,note,message,content,created_at,created_by,admin_id",
      lead_id: `eq.${leadId || leadCode}`,
      order: "created_at.desc",
      limit: "50",
    }),
    new URLSearchParams({
      select: "*",
      lead_id: `eq.${leadId || leadCode}`,
      order: "created_at.desc",
      limit: "50",
    }),
  ]);

  if (leadNotes.length > 0) {
    return leadNotes.map((row) => ({
      id: safeString(row.id) || randomUUID(),
      message: safeString(row.note) || safeString(row.message) || safeString(row.content) || "-",
      created_at: safeString(row.created_at) || null,
      created_by: safeString(row.created_by) || safeString(row.admin_id) || null,
      source: "lead_notes",
    }));
  }

  const logs = await selectManyWithFallback(db, "system_logs", [
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

  return logs
    .filter((row) => {
      const entityId = safeString(row.entity_id);
      const matchesLead =
        (leadId && entityId === leadId) ||
        (leadCode && entityId === leadCode) ||
        safeLower(row.event) === "lead_note";
      return matchesLead;
    })
    .map((row) => ({
      id: safeString(row.id) || randomUUID(),
      message: safeString(row.message) || safeString(row.note) || safeString(row.details) || "-",
      created_at: safeString(row.created_at) || null,
      created_by: safeString(row.created_by) || safeString(row.admin_id) || null,
      source: "system_logs",
    }));
}

export async function getAgentLeadDetail(userId: string, leadRef: string): Promise<AgentLeadDetail> {
  try {
    const db = new SupabaseRestClient();
    const lead = await resolveOwnedLeadByRef(db, userId, leadRef);
    if (!lead) {
      return {
        lead: null,
        quotations: [],
        booking: null,
        notes: [],
      };
    }

    const ownedQuotes = await fetchQuotesForOwnedLeads(db, [lead]);
    const ownedBookings = await fetchBookingsForOwnedLeads(db, [lead], ownedQuotes);
    const notes = await fetchLeadNotes(db, lead);

    return {
      lead,
      quotations: ownedQuotes,
      booking: ownedBookings[0] ?? null,
      notes,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { lead: null, quotations: [], booking: null, notes: [] };
    }
    return { lead: null, quotations: [], booking: null, notes: [] };
  }
}

export async function patchAgentLead(userId: string, leadRef: string, input: AgentLeadPatchInput): Promise<AgentLeadRow | null> {
  const requested = safeLower(input.stage);
  if (!requested) return null;
  if (!LEAD_STAGE_ORDER.includes(requested as AgentLeadStage)) return null;
  const stage = requested as AgentLeadStage;
  if (!EDITABLE_AGENT_STAGES.has(stage)) return null;

  try {
    const db = new SupabaseRestClient();
    const lead = await resolveOwnedLeadByRef(db, userId, leadRef);
    if (!lead || !lead.id) return null;

    const mapped = mapRequestedStageToDb(stage);
    if (!mapped.pipelineStage) return null;
    const metadata = { ...(lead.metadata ?? {}) };
    metadata.pipeline_stage = mapped.pipelineStage;
    metadata.updated_by_agent = userId;
    metadata.updated_by_agent_at = new Date().toISOString();

    const updates: Array<Record<string, unknown>> = [
      {
        status: mapped.dbStatus ?? lead.status ?? "lead_created",
        metadata,
        updated_at: new Date().toISOString(),
      },
      {
        status: mapped.dbStatus ?? lead.status ?? "lead_created",
        metadata,
      },
      {
        metadata,
      },
    ];

    let updated: GenericRow | null = null;
    for (const payload of updates) {
      updated = await safeUpdate(
        db,
        "leads",
        new URLSearchParams({
          select: "id,lead_code,agent_id,created_by,source,destination_country,destination_city,travel_start_date,travel_end_date,budget,status,assigned_to,booking_id,notes,requirements,customer_name,customer_email,customer_phone,metadata,created_at,updated_at",
          id: `eq.${lead.id}`,
        }),
        payload
      );
      if (updated) break;
    }

    if (!updated) return null;

    await writeSystemLog(db, {
      event: "lead_stage_updated_by_agent",
      entityId: safeString(lead.id) || safeString(lead.lead_code) || safeString(lead.lead_id),
      message: `Lead stage moved to ${stage}`,
      meta: {
        stage,
        agent_id: userId,
      },
    });

    const normalized = normalizeLeadRow(updated);
    return isOwnedLead(normalized, userId) ? normalized : null;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

export async function addAgentLeadNote(
  userId: string,
  leadRef: string,
  message: string
): Promise<{ ok: boolean }> {
  const note = safeString(message);
  if (!note) return { ok: false };

  try {
    const db = new SupabaseRestClient();
    const lead = await resolveOwnedLeadByRef(db, userId, leadRef);
    const leadId = safeString(lead?.id) || safeString(lead?.lead_code);
    if (!leadId) return { ok: false };

    const leadNotePayloads: Array<Record<string, unknown>> = [
      {
        id: randomUUID(),
        lead_id: safeString(lead?.id) || leadId,
        note,
        created_by: userId,
        created_at: new Date().toISOString(),
      },
      {
        lead_id: safeString(lead?.id) || leadId,
        note,
        created_by: userId,
      },
      {
        lead_id: safeString(lead?.id) || leadId,
        message: note,
      },
    ];

    let inserted = false;
    for (const payload of leadNotePayloads) {
      const row = await safeInsert(db, "lead_notes", payload);
      if (row) {
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      await writeSystemLog(db, {
        event: "lead_note",
        entityId: leadId,
        message: note,
        meta: {
          source: "agent_portal",
          agent_id: userId,
        },
      });
      inserted = true;
    } else {
      await writeSystemLog(db, {
        event: "lead_note",
        entityId: leadId,
        message: "Agent note added",
        meta: {
          source: "agent_portal",
          agent_id: userId,
          note_preview: note.slice(0, 200),
        },
      });
    }

    return { ok: inserted };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { ok: false };
    return { ok: false };
  }
}

function filterQuotes(
  rows: AgentQuoteRow[],
  filters: { q?: string; status?: string; limit?: number; offset?: number }
): { rows: AgentQuoteRow[]; total: number } {
  const search = safeLower(filters.q);
  const status = safeLower(filters.status);
  const filtered = rows.filter((row) => {
    if (status && status !== "all" && safeLower(row.status) !== status) return false;
    if (search) {
      const haystack = [
        safeString(row.quotation_id),
        safeString(row.quotation_code),
        safeString(row.booking_id),
        safeString(row.status),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  const limit = parseLimit(filters.limit);
  const offset = parseOffset(filters.offset);
  return {
    rows: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export async function listAgentQuotes(
  userId: string,
  filters: { q?: string; status?: string; limit?: number; offset?: number }
): Promise<{ rows: AgentQuoteRow[]; total: number }> {
  try {
    const db = new SupabaseRestClient();
    const ownedLeads = await fetchOwnedLeads(db, userId);
    const quotes = await fetchQuotesForOwnedLeads(db, ownedLeads);
    const sorted = quotes.sort((a, b) => {
      const ta = safeDate(a.created_at)?.getTime() ?? 0;
      const tb = safeDate(b.created_at)?.getTime() ?? 0;
      return tb - ta;
    });
    return filterQuotes(sorted, filters);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { rows: [], total: 0 };
    return { rows: [], total: 0 };
  }
}

function filterBookings(
  rows: AgentBookingRow[],
  filters: { q?: string; payment_status?: string; status?: string; limit?: number; offset?: number }
): { rows: AgentBookingRow[]; total: number } {
  const search = safeLower(filters.q);
  const paymentStatus = safeLower(filters.payment_status);
  const status = safeLower(filters.status);

  const filtered = rows.filter((row) => {
    if (paymentStatus && paymentStatus !== "all") {
      if (safeLower(row.payment_status) !== paymentStatus) return false;
    }
    if (status && status !== "all") {
      if (safeLower(row.status) !== status) return false;
    }
    if (search) {
      const haystack = [safeString(row.booking_id), safeString(row.status), safeString(row.payment_status)]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const limit = parseLimit(filters.limit);
  const offset = parseOffset(filters.offset);
  return {
    rows: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}

export async function listAgentBookings(
  userId: string,
  filters: { q?: string; payment_status?: string; status?: string; limit?: number; offset?: number }
): Promise<{ rows: AgentBookingRow[]; total: number }> {
  try {
    const db = new SupabaseRestClient();
    const ownedLeads = await fetchOwnedLeads(db, userId);
    const ownedQuotes = await fetchQuotesForOwnedLeads(db, ownedLeads);
    const bookings = await fetchBookingsForOwnedLeads(db, ownedLeads, ownedQuotes);
    const withCounts = applyDocumentsCount(bookings, await fetchDocumentsCountByBooking(db, bookings));
    const sorted = withCounts.sort((a, b) => {
      const ta = safeDate(a.created_at)?.getTime() ?? 0;
      const tb = safeDate(b.created_at)?.getTime() ?? 0;
      return tb - ta;
    });
    return filterBookings(sorted, filters);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { rows: [], total: 0 };
    return { rows: [], total: 0 };
  }
}

async function resolveOwnedBookingByRef(
  db: SupabaseRestClient,
  userId: string,
  bookingRef: string
): Promise<{
  booking: AgentBookingRow | null;
  ownedLeads: AgentLeadRow[];
  ownedQuotes: AgentQuoteRow[];
}> {
  const ownedLeads = await fetchOwnedLeads(db, userId);
  const ownedQuotes = await fetchQuotesForOwnedLeads(db, ownedLeads);
  const ownedBookings = await fetchBookingsForOwnedLeads(db, ownedLeads, ownedQuotes);
  const target = safeString(bookingRef);
  const booking =
    ownedBookings.find((row) => safeString(row.booking_id) === target) ??
    ownedBookings.find((row) => safeString(row.id) === target) ??
    null;

  return { booking, ownedLeads, ownedQuotes };
}

export async function getAgentBookingDetail(userId: string, bookingRef: string): Promise<AgentBookingDetail> {
  const ref = safeString(bookingRef);
  if (!ref) return { booking: null, lead: null, quotations: [], payments: [], documents: [] };

  try {
    const db = new SupabaseRestClient();
    const { booking, ownedLeads, ownedQuotes } = await resolveOwnedBookingByRef(db, userId, ref);
    if (!booking) return { booking: null, lead: null, quotations: [], payments: [], documents: [] };

    const bookingRefs = Array.from(new Set([safeString(booking.id), safeString(booking.booking_id)].filter(Boolean)));
    const lead = ownedLeads.find((row) => safeString(row.id) === safeString(booking.lead_id)) ?? null;
    const relatedQuotes = ownedQuotes.filter(
      (quote) =>
        (safeString(quote.booking_id) && safeString(quote.booking_id) === safeString(booking.id)) ||
        (safeString(quote.booking_id) && safeString(quote.booking_id) === safeString(booking.booking_id)) ||
        (safeString(quote.id) && safeString(quote.id) === safeString(booking.quotation_id))
    );

    let payments: AgentBookingDetail["payments"] = [];
    for (const bookingId of bookingRefs) {
      const rows = await selectManyWithFallback(db, "payments", [
        new URLSearchParams({
          select: "id,booking_id,amount,total_amount,currency_code,currency,status,provider,payment_link_url,public_payment_url,created_at",
          booking_id: `eq.${bookingId}`,
          order: "created_at.desc",
          limit: "20",
        }),
        new URLSearchParams({
          select: "id,booking_id,amount,currency_code,status,provider,created_at",
          booking_id: `eq.${bookingId}`,
          order: "created_at.desc",
          limit: "20",
        }),
      ]);
      if (rows.length === 0) continue;
      payments = rows.map((row) => ({
        id: safeString(row.id) || null,
        amount: toNumber(row.amount) ?? toNumber(row.total_amount),
        currency: safeString(row.currency_code) || safeString(row.currency) || "INR",
        status: safeString(row.status) || null,
        provider: safeString(row.provider) || null,
        payment_url: safeString(row.public_payment_url) || safeString(row.payment_link_url) || null,
        created_at: safeString(row.created_at) || null,
      }));
      break;
    }

    let documents: AgentBookingDetail["documents"] = [];
    for (const bookingId of bookingRefs) {
      const rows = await selectManyWithFallback(db, "documents", [
        new URLSearchParams({
          select: "id,booking_id,type,name,status,url,public_url,file_url,created_at,metadata",
          booking_id: `eq.${bookingId}`,
          order: "created_at.desc",
          limit: "40",
        }),
        new URLSearchParams({
          select: "id,booking_id,type,status,url,created_at",
          booking_id: `eq.${bookingId}`,
          order: "created_at.desc",
          limit: "40",
        }),
      ]);
      if (rows.length === 0) continue;
      documents = rows.map((row) => {
        const metadata = toObject(row.metadata);
        return {
          id: safeString(row.id) || null,
          type: safeString(row.type) || null,
          name:
            safeString(row.name) ||
            safeString(metadata?.name) ||
            safeString(metadata?.title) ||
            `${safeString(row.type) || "document"}`,
          status: safeString(row.status) || null,
          url: safeString(row.public_url) || safeString(row.url) || safeString(row.file_url) || null,
          created_at: safeString(row.created_at) || null,
        };
      });
      break;
    }

    return {
      booking,
      lead,
      quotations: relatedQuotes,
      payments,
      documents,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { booking: null, lead: null, quotations: [], payments: [], documents: [] };
    }
    return { booking: null, lead: null, quotations: [], payments: [], documents: [] };
  }
}
