import "server-only";

import {
  CUSTOMER_AUTH_COOKIE_NAME,
  verifyCustomerSessionToken,
} from "@/lib/backend/customerAuth";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

type CookieStore = {
  get(name: string): { value: string } | undefined;
};
type GenericRow = Record<string, unknown>;

export interface CustomerPortalSession {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  provider: "google" | "mobile_otp";
}

export interface CustomerTripListItem {
  booking_id: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string | null;
}

export interface CustomerTripDocument {
  id: string | null;
  type: string | null;
  name: string | null;
  url: string | null;
  created_at: string | null;
}

export interface CustomerTripItem {
  id: string | null;
  type: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
}

export interface CustomerTripDetail {
  booking: CustomerTripListItem | null;
  documents: CustomerTripDocument[];
  items: CustomerTripItem[];
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeBookingRef(row: GenericRow): string {
  return (
    safeString(row.booking_id) ||
    safeString(row.booking_code) ||
    safeString(row.reference) ||
    safeString(row.id)
  );
}

function normalizeBookingStatus(row: GenericRow): string | null {
  return safeString(row.status) || safeString(row.lifecycle_status) || null;
}

function normalizeBookingCurrency(row: GenericRow): string | null {
  return safeString(row.currency) || safeString(row.currency_code) || null;
}

function normalizeBookingAmount(row: GenericRow): number | null {
  return (
    toNumber(row.total_amount) ??
    toNumber(row.gross_amount) ??
    toNumber(row.amount) ??
    null
  );
}

function isOwnedBySession(row: GenericRow, session: CustomerPortalSession): boolean {
  const userId = safeString(row.user_id);
  const customerId = safeString(row.customer_id);
  const customerEmail = safeString(row.customer_email).toLowerCase();
  const customerPhone = safeString(row.customer_phone);
  const sessionEmail = safeString(session.email).toLowerCase();
  const sessionPhone = safeString(session.phone);

  if (userId && userId === session.id) return true;
  if (customerId && customerId === session.id) return true;
  if (customerEmail && sessionEmail && customerEmail === sessionEmail) return true;
  if (customerPhone && sessionPhone && customerPhone === sessionPhone) return true;
  return false;
}

function uniqueByBookingId(rows: CustomerTripListItem[]): CustomerTripListItem[] {
  const seen = new Set<string>();
  const out: CustomerTripListItem[] = [];
  for (const row of rows) {
    if (!row.booking_id || seen.has(row.booking_id)) continue;
    seen.add(row.booking_id);
    out.push(row);
  }
  return out;
}

async function safeSelectMany(db: SupabaseRestClient, table: string, query: URLSearchParams): Promise<GenericRow[]> {
  try {
    const rows = await db.selectMany<GenericRow>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function queryBookingsByOwnership(
  db: SupabaseRestClient,
  session: CustomerPortalSession,
  opts?: { bookingRef?: string; limit?: number }
): Promise<GenericRow[]> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
  const baseSelect =
    "id,booking_id,booking_code,status,lifecycle_status,payment_status,total_amount,gross_amount,currency,currency_code,created_at,user_id,customer_id,customer_email,customer_phone";
  const bookingRef = safeString(opts?.bookingRef);
  const attempts: Array<{ key: string; value: string }> = [];

  // Prefer direct ID matches if bookingRef is provided, but still apply ownership later.
  if (bookingRef) {
    attempts.push(
      { key: "booking_id", value: `eq.${bookingRef}` },
      { key: "booking_code", value: `eq.${bookingRef}` },
      { key: "id", value: `eq.${bookingRef}` }
    );
  }

  // Ownership-first attempts.
  attempts.push(
    { key: "user_id", value: `eq.${session.id}` },
    { key: "customer_id", value: `eq.${session.id}` }
  );
  if (safeString(session.email)) {
    attempts.push({ key: "customer_email", value: `eq.${safeString(session.email)}` });
  }
  if (safeString(session.phone)) {
    attempts.push({ key: "customer_phone", value: `eq.${safeString(session.phone)}` });
  }

  const collected: GenericRow[] = [];
  const seen = new Set<string>();

  for (const attempt of attempts) {
    const query = new URLSearchParams({
      select: baseSelect,
      order: "created_at.desc",
      limit: String(limit),
    });
    query.set(attempt.key, attempt.value);
    const rows = await safeSelectMany(db, "bookings", query);
    for (const row of rows) {
      const dedupeKey = safeString(row.id) || normalizeBookingRef(row);
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      collected.push(row);
    }
  }

  return collected;
}

function normalizeBookingListItem(row: GenericRow): CustomerTripListItem | null {
  const booking_id = normalizeBookingRef(row);
  if (!booking_id) return null;
  return {
    booking_id,
    status: normalizeBookingStatus(row),
    payment_status: safeString(row.payment_status) || null,
    total_amount: normalizeBookingAmount(row),
    currency: normalizeBookingCurrency(row),
    created_at: safeString(row.created_at) || null,
  };
}

function deriveDocumentName(row: GenericRow): string | null {
  const explicit = safeString(row.name) || safeString(row.file_name) || safeString(row.document_name);
  if (explicit) return explicit;

  const meta = toObject(row.metadata);
  const metaName =
    safeString(meta?.name) ||
    safeString(meta?.title) ||
    safeString(meta?.file_name) ||
    safeString(meta?.filename);
  if (metaName) return metaName;

  const path = safeString(row.storage_path) || safeString(row.file_path);
  if (path) {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || path;
  }

  return null;
}

async function fetchDocumentsForBooking(db: SupabaseRestClient, bookingRow: GenericRow): Promise<CustomerTripDocument[]> {
  const bookingUuid = safeString(bookingRow.id);
  const bookingRef = normalizeBookingRef(bookingRow);

  const attempts: Array<URLSearchParams> = [];
  for (const bookingIdValue of [bookingUuid, bookingRef]) {
    if (!bookingIdValue) continue;
    attempts.push(
      new URLSearchParams({
        select: "id,type,name,url,public_url,created_at,metadata,storage_path,file_path",
        booking_id: `eq.${bookingIdValue}`,
        order: "created_at.desc",
        limit: "20",
      })
    );
  }

  let rows: GenericRow[] = [];
  for (const query of attempts) {
    rows = await safeSelectMany(db, "documents", query);
    if (rows.length > 0) break;
  }
  // Fallback table name if used.
  if (rows.length === 0) {
    for (const query of attempts) {
      rows = await safeSelectMany(db, "booking_documents", query);
      if (rows.length > 0) break;
    }
  }

  return rows.map((row) => ({
    id: safeString(row.id) || null,
    type: safeString(row.type) || null,
    name: deriveDocumentName(row),
    url: safeString(row.url) || safeString(row.public_url) || null,
    created_at: safeString(row.created_at) || null,
  }));
}

async function fetchItemsForBooking(db: SupabaseRestClient, bookingRow: GenericRow): Promise<CustomerTripItem[]> {
  const bookingUuid = safeString(bookingRow.id);
  const bookingRef = normalizeBookingRef(bookingRow);
  const attempts: Array<URLSearchParams> = [];

  for (const bookingIdValue of [bookingUuid, bookingRef]) {
    if (!bookingIdValue) continue;
    attempts.push(
      new URLSearchParams({
        select:
          "id,type,item_type,title,start_date,end_date,amount,total_amount,currency,currency_code,status,start_at,end_at,service_start_at,service_end_at,metadata",
        booking_id: `eq.${bookingIdValue}`,
        order: "created_at.asc",
        limit: "50",
      })
    );
  }

  let rows: GenericRow[] = [];
  for (const query of attempts) {
    rows = await safeSelectMany(db, "booking_items", query);
    if (rows.length > 0) break;
  }

  return rows.map((row) => {
    const meta = toObject(row.metadata);
    return {
      id: safeString(row.id) || null,
      type: safeString(row.type) || safeString(row.item_type) || null,
      title:
        safeString(row.title) ||
        safeString(meta?.title) ||
        safeString(meta?.name) ||
        null,
      start_date:
        safeString(row.start_date) ||
        safeString(row.start_at) ||
        safeString(row.service_start_at) ||
        null,
      end_date:
        safeString(row.end_date) ||
        safeString(row.end_at) ||
        safeString(row.service_end_at) ||
        null,
      amount: toNumber(row.amount) ?? toNumber(row.total_amount),
      currency: safeString(row.currency) || safeString(row.currency_code) || null,
      status: safeString(row.status) || null,
    };
  });
}

export async function getCustomerPortalSession(cookieStore: CookieStore): Promise<CustomerPortalSession | null> {
  const token = cookieStore.get(CUSTOMER_AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = verifyCustomerSessionToken(token);
  if (!session) return null;
  return session;
}

export async function listCustomerTrips(session: CustomerPortalSession): Promise<CustomerTripListItem[]> {
  try {
    const db = new SupabaseRestClient();
    const rows = await queryBookingsByOwnership(db, session, { limit: 50 });
    const ownedRows = rows.filter((row) => isOwnedBySession(row, session));
    const normalized = ownedRows
      .map(normalizeBookingListItem)
      .filter((row): row is CustomerTripListItem => Boolean(row))
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
    return uniqueByBookingId(normalized).slice(0, 50);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return [];
    return [];
  }
}

export async function getCustomerTripDetail(
  session: CustomerPortalSession,
  bookingRef: string
): Promise<CustomerTripDetail> {
  const trimmedRef = safeString(bookingRef);
  if (!trimmedRef) {
    return { booking: null, documents: [], items: [] };
  }

  try {
    const db = new SupabaseRestClient();
    const rows = await queryBookingsByOwnership(db, session, {
      bookingRef: trimmedRef,
      limit: 50,
    });
    const ownedRows = rows.filter((row) => isOwnedBySession(row, session));
    const bookingRow =
      ownedRows.find((row) => normalizeBookingRef(row) === trimmedRef) ??
      ownedRows.find((row) => safeString(row.id) === trimmedRef) ??
      null;

    if (!bookingRow) {
      return { booking: null, documents: [], items: [] };
    }

    const booking = normalizeBookingListItem(bookingRow);
    const [documents, items] = await Promise.all([
      fetchDocumentsForBooking(db, bookingRow),
      fetchItemsForBooking(db, bookingRow),
    ]);

    return {
      booking,
      documents,
      items,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { booking: null, documents: [], items: [] };
    }
    return { booking: null, documents: [], items: [] };
  }
}
