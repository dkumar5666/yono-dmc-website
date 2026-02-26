import "server-only";

import crypto from "node:crypto";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

type GenericRow = Record<string, unknown>;

export interface SupportRequestRecord {
  id: string | null;
  booking_id: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  category: string | null;
  subject: string | null;
  message: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
  meta?: unknown;
  _sourceTable?: string;
}

export interface SupportRequestCreateInput {
  booking_id: string;
  customer_id: string;
  customer_email?: string;
  customer_phone?: string;
  category: "voucher" | "payment" | "cancellation" | "change" | "other";
  subject: string;
  message: string;
}

export interface AdminSupportRequestListFilters {
  status?: string;
  booking_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export class SupportSystemUnavailableError extends Error {
  constructor(message = "Support system not available yet") {
    super(message);
    this.name = "SupportSystemUnavailableError";
  }
}

const PRIMARY_SUPPORT_TABLES = ["support_requests", "customer_requests", "helpdesk_tickets"] as const;
const READ_SUPPORT_TABLES = [
  ...PRIMARY_SUPPORT_TABLES,
  "custom_package_requests",
] as const;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function requestMatchesCustomer(row: SupportRequestRecord, session: {
  id: string;
  email?: string;
  phone?: string;
}): boolean {
  const rowCustomerId = safeString(row.customer_id);
  const rowEmail = safeString(row.customer_email).toLowerCase();
  const rowPhone = safeString(row.customer_phone);
  const sessionEmail = safeString(session.email).toLowerCase();
  const sessionPhone = safeString(session.phone);

  if (rowCustomerId && rowCustomerId === session.id) return true;
  if (rowEmail && sessionEmail && rowEmail === sessionEmail) return true;
  if (rowPhone && sessionPhone && rowPhone === sessionPhone) return true;
  return false;
}

function supportSelectVariantsForTable(table: string): string[] {
  if (table === "custom_package_requests") {
    return [
      "id,booking_id,customer_email,customer_phone,status,notes,admin_notes,created_at,updated_at,destination",
      "id,customer_email,customer_phone,status,notes,admin_notes,created_at,updated_at,destination",
      "id,customer_email,customer_phone,status,notes,created_at,destination",
    ];
  }

  return [
    "id,booking_id,customer_id,customer_email,customer_phone,category,subject,message,status,priority,created_at,updated_at,meta",
    "id,booking_id,customer_id,customer_email,customer_phone,category,subject,message,status,priority,created_at,updated_at",
    "id,booking_id,customer_id,customer_email,customer_phone,category,subject,message,status,created_at,updated_at",
    "id,booking_id,customer_email,customer_phone,category,subject,message,status,created_at",
    "id,booking_id,subject,message,status,created_at",
  ];
}

function mapSupportRow(table: string, row: GenericRow): SupportRequestRecord {
  if (table === "custom_package_requests") {
    const destination = safeString(row.destination);
    const notes = safeString(row.notes);
    const adminNotes = safeString(row.admin_notes);
    return {
      id: safeString(row.id) || null,
      booking_id: safeString(row.booking_id) || null,
      customer_id: safeString(row.customer_id) || null,
      customer_email: safeString(row.customer_email) || null,
      customer_phone: safeString(row.customer_phone) || null,
      category: "other",
      subject: destination ? `Custom package request: ${destination}` : "Custom package request",
      message: notes || adminNotes || null,
      status: safeString(row.status) || "open",
      priority: null,
      created_at: safeString(row.created_at) || null,
      updated_at: safeString(row.updated_at) || null,
      meta: null,
      _sourceTable: table,
    };
  }

  return {
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_id) || null,
    customer_id: safeString(row.customer_id) || null,
    customer_email: safeString(row.customer_email) || null,
    customer_phone: safeString(row.customer_phone) || null,
    category: safeString(row.category) || null,
    subject: safeString(row.subject) || null,
    message: safeString(row.message) || null,
    status: safeString(row.status) || "open",
    priority: safeString(row.priority) || null,
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
    meta: row.meta ?? null,
    _sourceTable: table,
  };
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

async function selectFromSupportTable(
  db: SupabaseRestClient,
  table: string,
  queryMutator: (query: URLSearchParams) => void
): Promise<{ rows: SupportRequestRecord[]; table: string } | null> {
  const variants = supportSelectVariantsForTable(table);
  for (const select of variants) {
    const query = new URLSearchParams();
    query.set("select", select);
    queryMutator(query);
    const result = await trySelectMany(db, table, query);
    if (!result.ok) continue;
    return {
      rows: result.rows.map((row) => mapSupportRow(table, row)),
      table,
    };
  }
  return null;
}

async function firstReadableSupportSource(
  db: SupabaseRestClient,
  queryMutator: (query: URLSearchParams) => void
): Promise<{ rows: SupportRequestRecord[]; table: string } | null> {
  for (const table of READ_SUPPORT_TABLES) {
    const result = await selectFromSupportTable(db, table, queryMutator);
    if (result) return result;
  }
  return null;
}

function sortByCreatedDesc<T extends { created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

export async function listCustomerSupportRequestsByBooking(
  session: { id: string; email?: string; phone?: string },
  bookingId: string
): Promise<SupportRequestRecord[]> {
  const bookingRef = safeString(bookingId);
  if (!bookingRef) return [];

  try {
    const db = new SupabaseRestClient();
    const result = await firstReadableSupportSource(db, (query) => {
      query.set("order", "created_at.desc");
      query.set("limit", "200");
      // booking_id may not exist on some fallback tables; select will fail and fallback safely.
      query.set("booking_id", `eq.${bookingRef}`);
    });
    if (!result) return [];
    return sortByCreatedDesc(
      result.rows.filter((row) => safeString(row.booking_id) === bookingRef && requestMatchesCustomer(row, session))
    );
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return [];
    return [];
  }
}

async function tryInsertSupportRequestIntoTable(
  db: SupabaseRestClient,
  table: string,
  input: SupportRequestCreateInput
): Promise<string | null> {
  const variants: Array<Record<string, unknown>> = [
    {
      id: crypto.randomUUID(),
      booking_id: input.booking_id,
      customer_id: input.customer_id,
      customer_email: input.customer_email ?? null,
      customer_phone: input.customer_phone ?? null,
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: "open",
      priority: "normal",
      meta: { source: "customer_portal" },
    },
    {
      id: crypto.randomUUID(),
      booking_id: input.booking_id,
      customer_id: input.customer_id,
      customer_email: input.customer_email ?? null,
      customer_phone: input.customer_phone ?? null,
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: "open",
      meta: { source: "customer_portal" },
    },
    {
      id: crypto.randomUUID(),
      booking_id: input.booking_id,
      customer_id: input.customer_id,
      customer_email: input.customer_email ?? null,
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: "open",
    },
    {
      id: crypto.randomUUID(),
      booking_id: input.booking_id,
      customer_email: input.customer_email ?? null,
      category: input.category,
      subject: input.subject,
      message: input.message,
      status: "open",
    },
    {
      id: crypto.randomUUID(),
      booking_id: input.booking_id,
      subject: input.subject,
      message: input.message,
      status: "open",
    },
  ];

  for (const payload of variants) {
    try {
      const inserted = await db.insertSingle<{ id?: string | null }>(table, payload);
      return safeString(inserted?.id) || null;
    } catch {
      // try smaller payload / next table
    }
  }
  return null;
}

export async function createCustomerSupportRequest(
  input: SupportRequestCreateInput
): Promise<{ id: string }> {
  try {
    const db = new SupabaseRestClient();
    for (const table of PRIMARY_SUPPORT_TABLES) {
      const id = await tryInsertSupportRequestIntoTable(db, table, input);
      if (id) return { id };
    }
    throw new SupportSystemUnavailableError();
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      throw new SupportSystemUnavailableError();
    }
    if (error instanceof SupportSystemUnavailableError) throw error;
    throw new SupportSystemUnavailableError();
  }
}

export async function listAdminSupportRequests(
  filters: AdminSupportRequestListFilters
): Promise<{ rows: SupportRequestRecord[]; total: number }> {
  try {
    const db = new SupabaseRestClient();
    const source = await firstReadableSupportSource(db, (query) => {
      query.set("order", "created_at.desc");
      query.set("limit", "500");
    });
    if (!source) return { rows: [], total: 0 };

    const status = safeString(filters.status).toLowerCase();
    const bookingId = safeString(filters.booking_id).toLowerCase();
    const q = safeString(filters.q).toLowerCase();
    const offset = parseOffset(filters.offset);
    const limit = parseLimit(filters.limit);

    const filtered = sortByCreatedDesc(source.rows).filter((row) => {
      const rowStatus = safeString(row.status).toLowerCase();
      const rowBooking = safeString(row.booking_id).toLowerCase();
      const rowSubject = safeString(row.subject).toLowerCase();
      const rowMessage = safeString(row.message).toLowerCase();
      const rowEmail = safeString(row.customer_email).toLowerCase();
      const rowPhone = safeString(row.customer_phone).toLowerCase();

      if (status && status !== "all" && rowStatus !== status) return false;
      if (bookingId && !rowBooking.includes(bookingId)) return false;
      if (q) {
        const haystack = [rowSubject, rowMessage, rowEmail, rowPhone, rowBooking].join(" ");
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return {
      rows: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { rows: [], total: 0 };
    return { rows: [], total: 0 };
  }
}

export async function getAdminSupportRequestById(id: string): Promise<SupportRequestRecord | null> {
  const ref = safeString(id);
  if (!ref) return null;

  try {
    const db = new SupabaseRestClient();
    for (const table of READ_SUPPORT_TABLES) {
      const variants = supportSelectVariantsForTable(table);
      for (const select of variants) {
        try {
          const row = await db.selectSingle<GenericRow>(
            table,
            new URLSearchParams({
              select,
              id: `eq.${ref}`,
            })
          );
          if (row) return mapSupportRow(table, row);
        } catch {
          // try next variant/table
        }
      }
    }
    return null;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

export async function countOpenSupportRequestsLast30Days(): Promise<number> {
  try {
    const db = new SupabaseRestClient();
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const table of PRIMARY_SUPPORT_TABLES) {
      const queryVariants: URLSearchParams[] = [
        new URLSearchParams({
          select: "id,status,created_at",
          order: "created_at.desc",
          limit: "500",
        }),
        new URLSearchParams({
          select: "id,status",
          limit: "500",
        }),
      ];
      for (const query of queryVariants) {
        const result = await trySelectMany(db, table, query);
        if (!result.ok) continue;
        return result.rows.filter((row) => {
          const status = safeString(row.status).toLowerCase();
          const createdAt = safeString(row.created_at);
          if (status !== "open") return false;
          if (!createdAt) return true;
          const date = new Date(createdAt);
          if (Number.isNaN(date.getTime())) return true;
          return date.toISOString() >= sinceIso;
        }).length;
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return 0;
    return 0;
  }
}
