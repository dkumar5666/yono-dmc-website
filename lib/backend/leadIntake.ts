import "server-only";

import { randomUUID } from "node:crypto";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import {
  buildLeadFingerprint,
  normalizeDate,
  normalizeEmail,
  parseDestinationParts,
  sanitizePhone,
} from "@/lib/leads/leadFingerprint";

type GenericRow = Record<string, unknown>;

export type LeadIntakeSource =
  | "website"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "google"
  | "referral"
  | "other";

export interface LeadIntakeInput {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  destination?: string | null;
  travel_start?: string | null;
  travel_end?: string | null;
  pax_adults?: number | null;
  pax_children?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  requirements?: string | null;
  source?: string | null;
  utm?: Record<string, unknown> | null;
  page_url?: string | null;
  company?: string | null;
}

export interface LeadIntakeResult {
  ok: boolean;
  lead_id: string | null;
  deduped: boolean;
}

interface RateBucket {
  requests: number[];
}

interface ParsedLeadInput {
  fullName: string;
  email: string;
  phone: string;
  destination: string;
  travelStart: string;
  travelEnd: string;
  paxAdults: number | null;
  paxChildren: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  requirements: string;
  source: LeadIntakeSource;
  utm: Record<string, string>;
  pageUrl: string;
  honeypotCompany: string;
}

interface LeadRef {
  id: string;
  leadCode: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

const SOURCE_VALUES = new Set<LeadIntakeSource>([
  "website",
  "whatsapp",
  "instagram",
  "facebook",
  "google",
  "referral",
  "other",
]);

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeInteger(value: unknown, min: number): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  if (rounded < min) return null;
  return rounded;
}

function sanitizeAmount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSource(value: unknown): LeadIntakeSource {
  const source = safeString(value).toLowerCase();
  if (SOURCE_VALUES.has(source as LeadIntakeSource)) return source as LeadIntakeSource;
  return "other";
}

function sanitizeUtm(value: unknown): Record<string, string> {
  const raw = safeObject(value);
  const out: Record<string, string> = {};
  for (const key of ["source", "medium", "campaign", "term", "content"]) {
    const val = safeString(raw[key]);
    if (val) out[key] = val;
  }
  return out;
}

function normalizeLeadInput(input: LeadIntakeInput): ParsedLeadInput {
  return {
    fullName: safeString(input.full_name),
    email: normalizeEmail(input.email),
    phone: sanitizePhone(input.phone),
    destination: safeString(input.destination),
    travelStart: normalizeDate(input.travel_start),
    travelEnd: normalizeDate(input.travel_end),
    paxAdults: sanitizeInteger(input.pax_adults, 0),
    paxChildren: sanitizeInteger(input.pax_children, 0),
    budgetMin: sanitizeAmount(input.budget_min),
    budgetMax: sanitizeAmount(input.budget_max),
    requirements: safeString(input.requirements),
    source: normalizeSource(input.source),
    utm: sanitizeUtm(input.utm),
    pageUrl: safeString(input.page_url),
    honeypotCompany: safeString(input.company),
  };
}

export function getClientIp(req: Request): string {
  const forwardedFor = safeString(req.headers.get("x-forwarded-for"));
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = safeString(req.headers.get("x-real-ip"));
  if (realIp) return realIp;
  return "unknown";
}

function getRateStore(): Map<string, RateBucket> {
  const g = globalThis as typeof globalThis & { __leadIntakeRateStore?: Map<string, RateBucket> };
  if (!g.__leadIntakeRateStore) g.__leadIntakeRateStore = new Map<string, RateBucket>();
  return g.__leadIntakeRateStore;
}

export function isLeadIntakeRateLimited(ip: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = ip || "unknown";
  const store = getRateStore();
  const bucket = store.get(key) ?? { requests: [] };

  bucket.requests = bucket.requests.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (bucket.requests.length >= RATE_LIMIT_MAX_REQUESTS) {
    store.set(key, bucket);
    const oldest = bucket.requests[0] ?? now;
    const retryMs = Math.max(1, RATE_LIMIT_WINDOW_MS - (now - oldest));
    return {
      limited: true,
      retryAfterSeconds: Math.ceil(retryMs / 1000),
    };
  }

  bucket.requests.push(now);
  store.set(key, bucket);
  return { limited: false, retryAfterSeconds: 0 };
}

function toMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
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

function normalizeLeadRef(row: GenericRow): LeadRef | null {
  const id = safeString(row.id);
  if (!id) return null;
  return {
    id,
    leadCode: safeString(row.lead_code) || id,
    createdAt: safeString(row.created_at),
    metadata: toMetadata(row.metadata),
  };
}

async function findExistingLeadByFingerprint(
  db: SupabaseRestClient,
  fingerprint: string,
  sinceIso: string
): Promise<LeadRef | null> {
  const direct = await safeSelectMany(
    db,
    "leads",
    new URLSearchParams({
      select: "id,lead_code,created_at,metadata",
      "metadata->>lead_fingerprint": `eq.${fingerprint}`,
      created_at: `gte.${sinceIso}`,
      order: "created_at.desc",
      limit: "20",
    })
  );

  const directRef = normalizeLeadRef(direct[0] ?? null);
  if (directRef) return directRef;

  const recent = await safeSelectMany(
    db,
    "leads",
    new URLSearchParams({
      select: "id,lead_code,created_at,metadata",
      created_at: `gte.${sinceIso}`,
      order: "created_at.desc",
      limit: "400",
    })
  );

  for (const row of recent) {
    const ref = normalizeLeadRef(row);
    if (!ref) continue;
    const fp = safeString(ref.metadata.lead_fingerprint);
    if (fp && fp === fingerprint) return ref;
  }

  const systemLogRows = await safeSelectMany(
    db,
    "system_logs",
    new URLSearchParams({
      select: "entity_id,created_at,metadata,meta",
      event: "eq.lead_intake",
      "metadata->>lead_fingerprint": `eq.${fingerprint}`,
      created_at: `gte.${sinceIso}`,
      order: "created_at.desc",
      limit: "20",
    })
  );

  for (const row of systemLogRows) {
    const entityId = safeString(row.entity_id);
    if (!entityId) continue;

    const byId = await safeSelectMany(
      db,
      "leads",
      new URLSearchParams({
        select: "id,lead_code,created_at,metadata",
        id: `eq.${entityId}`,
        limit: "1",
      })
    );
    const ref = normalizeLeadRef(byId[0] ?? null);
    if (ref) return ref;
  }

  return null;
}

function buildLeadMetadata(
  parsed: ParsedLeadInput,
  fingerprint: string,
  context: {
    pageUrl: string;
    utm: Record<string, string>;
    rawSource: string;
    rawPayload?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    lead_fingerprint: fingerprint,
    customer_name: parsed.fullName || null,
    customer_email: parsed.email || null,
    customer_phone: parsed.phone || null,
    budget_min: parsed.budgetMin,
    budget_max: parsed.budgetMax,
    requirements: parsed.requirements || null,
    page_url: context.pageUrl || null,
    source: parsed.source,
    utm: context.utm,
    raw_source: context.rawSource || null,
  };

  if (context.rawPayload) metadata.raw_payload = context.rawPayload;
  return metadata;
}

function buildLeadCode(prefix: string): string {
  const ts = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${ts}-${random}`;
}

function truncateString(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...`;
}

function sanitizeRawPayload(payload: unknown, maxLen = 6000): Record<string, unknown> {
  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) return {};
    if (serialized.length <= maxLen) {
      return JSON.parse(serialized) as Record<string, unknown>;
    }
    return {
      truncated: true,
      preview: truncateString(serialized, maxLen),
    };
  } catch {
    return { truncated: true, preview: "[unserializable payload]" };
  }
}

export async function writeLeadIntakeLog(
  db: SupabaseRestClient,
  args: {
    leadId: string;
    deduped: boolean;
    source: LeadIntakeSource;
    fingerprint: string;
    utm: Record<string, string>;
    pageUrl: string;
    rawPayload?: Record<string, unknown>;
    message?: string;
  }
): Promise<void> {
  const payloadMeta: Record<string, unknown> = {
    lead_fingerprint: args.fingerprint,
    deduped: args.deduped,
    source: args.source,
    utm: args.utm,
    page_url: args.pageUrl || null,
    raw_payload: args.rawPayload ?? null,
  };

  const attempts: Array<Record<string, unknown>> = [
    {
      level: "info",
      event: "lead_intake",
      entity_type: "lead",
      entity_id: args.leadId,
      message: args.message || (args.deduped ? "Lead intake deduped" : "Lead intake created"),
      metadata: payloadMeta,
    },
    {
      level: "info",
      event: "lead_intake",
      entity_type: "lead",
      entity_id: args.leadId,
      message: args.message || (args.deduped ? "Lead intake deduped" : "Lead intake created"),
      meta: payloadMeta,
    },
    {
      event: "lead_intake",
      message: args.message || "Lead intake",
      meta: payloadMeta,
    },
  ];

  for (const payload of attempts) {
    const inserted = await safeInsert(db, "system_logs", payload);
    if (inserted) return;
  }
}

export async function createOrDeduplicateLead(
  input: LeadIntakeInput,
  options?: {
    sourceOverride?: LeadIntakeSource;
    rawPayloadForLogs?: unknown;
    leadCodePrefix?: string;
  }
): Promise<LeadIntakeResult> {
  const parsed = normalizeLeadInput(input);

  if (parsed.honeypotCompany) {
    throw new Error("honeypot_rejected");
  }
  if (!parsed.destination) {
    throw new Error("destination_required");
  }
  if (!parsed.phone && !parsed.email) {
    throw new Error("contact_required");
  }

  const source = options?.sourceOverride ?? parsed.source;
  const fingerprint = buildLeadFingerprint({
    email: parsed.email,
    phone: parsed.phone,
    destination: parsed.destination,
    travelStart: parsed.travelStart,
    travelEnd: parsed.travelEnd,
  });

  const db = new SupabaseRestClient();
  const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
  const existing = await findExistingLeadByFingerprint(db, fingerprint, sinceIso);

  const sanitizedRawPayload = options?.rawPayloadForLogs
    ? sanitizeRawPayload(options.rawPayloadForLogs)
    : undefined;

  if (existing) {
    await writeLeadIntakeLog(db, {
      leadId: existing.id,
      deduped: true,
      source,
      fingerprint,
      utm: parsed.utm,
      pageUrl: parsed.pageUrl,
      rawPayload: sanitizedRawPayload,
      message: "Lead intake deduped by fingerprint",
    });

    return {
      ok: true,
      lead_id: existing.id || existing.leadCode,
      deduped: true,
    };
  }

  const destinationParts = parseDestinationParts(parsed.destination);
  const metadata = buildLeadMetadata(parsed, fingerprint, {
    pageUrl: parsed.pageUrl,
    utm: parsed.utm,
    rawSource: safeString(input.source),
    rawPayload: sanitizedRawPayload,
  });

  const leadCodePrefix = safeString(options?.leadCodePrefix) || "LEAD";
  const leadCode = buildLeadCode(leadCodePrefix.toUpperCase());

  const fullPayload: Record<string, unknown> = {
    id: randomUUID(),
    lead_code: leadCode,
    source,
    destination_country: destinationParts.country,
    destination_city: destinationParts.city,
    travel_start_date: parsed.travelStart !== "na" ? parsed.travelStart : null,
    travel_end_date: parsed.travelEnd !== "na" ? parsed.travelEnd : null,
    pax_adults: parsed.paxAdults ?? 1,
    pax_children: parsed.paxChildren ?? 0,
    notes: parsed.requirements || null,
    status: "lead_created",
    metadata,
  };

  const payloadVariants: Array<Record<string, unknown>> = [
    fullPayload,
    {
      id: randomUUID(),
      lead_code: leadCode,
      source,
      destination_country: destinationParts.country,
      destination_city: destinationParts.city,
      travel_start_date: parsed.travelStart !== "na" ? parsed.travelStart : null,
      travel_end_date: parsed.travelEnd !== "na" ? parsed.travelEnd : null,
      notes: parsed.requirements || null,
      status: "lead_created",
      metadata,
    },
    {
      id: randomUUID(),
      lead_code: leadCode,
      source,
      destination_country: destinationParts.country,
      destination_city: destinationParts.city,
      status: "lead_created",
      metadata,
    },
    {
      id: randomUUID(),
      lead_code: leadCode,
      source,
      destination_country: destinationParts.country,
      destination_city: destinationParts.city,
      status: "lead_created",
      notes: parsed.requirements || null,
    },
  ];

  let insertedLead: GenericRow | null = null;
  for (const payload of payloadVariants) {
    insertedLead = await safeInsert(db, "leads", payload);
    if (insertedLead) break;
  }

  if (!insertedLead) {
    throw new Error("lead_create_failed");
  }

  const insertedLeadId = safeString(insertedLead.id);
  const insertedLeadCode = safeString(insertedLead.lead_code) || insertedLeadId;

  await writeLeadIntakeLog(db, {
    leadId: insertedLeadId || insertedLeadCode,
    deduped: false,
    source,
    fingerprint,
    utm: parsed.utm,
    pageUrl: parsed.pageUrl,
    rawPayload: sanitizedRawPayload,
    message: "Lead intake created",
  });

  return {
    ok: true,
    lead_id: insertedLeadId || insertedLeadCode,
    deduped: false,
  };
}

export function toSafeErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return "intake_failed";
  const message = error.message;
  if (message === "honeypot_rejected") return "spam_rejected";
  if (message === "destination_required") return "destination_required";
  if (message === "contact_required") return "contact_required";
  if (message === "lead_create_failed") return "lead_create_failed";
  if (error instanceof SupabaseNotConfiguredError) return "supabase_not_configured";
  return "intake_failed";
}
