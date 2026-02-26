import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type SearchResultType =
  | "booking"
  | "payment"
  | "refund"
  | "document"
  | "supplier_log"
  | "automation_failure";

interface AdminSearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

type GenericRow = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 8);
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(20, Math.max(1, Math.floor(parsed)));
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isBookingLike(value: string): boolean {
  return /(^bk[\-_])|(^booking[\-_])|(^bk\d)|(^bk$)/i.test(value.trim());
}

function ilike(value: string): string {
  return `ilike.*${value.replaceAll("*", "")}*`;
}

async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    return await db.selectMany<T>(table, query);
  } catch {
    return [];
  }
}

async function trySelectAttempts(
  db: SupabaseRestClient,
  attempts: Array<{ table: string; query: URLSearchParams }>
): Promise<GenericRow[]> {
  for (const attempt of attempts) {
    const rows = await safeSelectMany<GenericRow>(db, attempt.table, attempt.query);
    if (rows.length > 0) return rows;
  }
  return [];
}

function pushResult(
  acc: AdminSearchResult[],
  dedupe: Set<string>,
  result: AdminSearchResult,
  limit: number
) {
  if (acc.length >= limit) return;
  const key = `${result.type}:${result.id}`;
  if (!result.id || dedupe.has(key)) return;
  dedupe.add(key);
  acc.push(result);
}

async function searchBookings(
  db: SupabaseRestClient,
  q: string,
  remaining: number,
  push: (result: AdminSearchResult) => void
) {
  if (remaining <= 0) return;
  const searches: Array<{ attempts: Array<{ table: string; query: URLSearchParams }>; map: (row: GenericRow) => AdminSearchResult | null }> = [];

  if (isBookingLike(q) || isUuidLike(q) || q.length >= 2) {
    searches.push({
      attempts: [
        {
          table: "bookings",
          query: new URLSearchParams({
            select: "id,booking_code,lifecycle_status,payment_status",
            booking_code: ilike(q),
            order: "created_at.desc",
            limit: String(Math.min(3, remaining)),
          }),
        },
        {
          table: "bookings",
          query: new URLSearchParams({
            select: "id,booking_id,status,payment_status",
            booking_id: ilike(q),
            order: "created_at.desc",
            limit: String(Math.min(3, remaining)),
          }),
        },
      ],
      map: (row) => {
        const bookingRef = safeString(row.booking_code) || safeString(row.booking_id) || safeString(row.id);
        if (!bookingRef) return null;
        const status = safeString(row.lifecycle_status) || safeString(row.status);
        const pay = safeString(row.payment_status);
        const subtitle = [status, pay ? `payment: ${pay}` : ""].filter(Boolean).join(" | ");
        return {
          type: "booking",
          id: bookingRef,
          title: bookingRef,
          subtitle: subtitle || undefined,
          href: `/admin/bookings/${encodeURIComponent(bookingRef)}`,
        };
      },
    });
  }

  if (isUuidLike(q)) {
    searches.unshift({
      attempts: [
        {
          table: "bookings",
          query: new URLSearchParams({
            select: "id,booking_code,lifecycle_status,payment_status",
            id: `eq.${q}`,
            limit: "1",
          }),
        },
      ],
      map: (row) => {
        const bookingRef = safeString(row.booking_code) || safeString(row.booking_id) || safeString(row.id);
        if (!bookingRef) return null;
        return {
          type: "booking",
          id: bookingRef,
          title: bookingRef,
          subtitle: [safeString(row.lifecycle_status) || safeString(row.status), safeString(row.payment_status)]
            .filter(Boolean)
            .join(" | ") || undefined,
          href: `/admin/bookings/${encodeURIComponent(bookingRef)}`,
        };
      },
    });
  }

  for (const search of searches) {
    if (remaining <= 0) break;
    const rows = await trySelectAttempts(db, search.attempts);
    for (const row of rows.slice(0, remaining)) {
      const mapped = search.map(row);
      if (mapped) push(mapped);
    }
    remaining = remaining - rows.slice(0, remaining).length;
  }
}

async function searchPayments(
  db: SupabaseRestClient,
  q: string,
  remaining: number,
  push: (result: AdminSearchResult) => void
) {
  if (remaining <= 0) return;

  const byIdRows = isUuidLike(q)
    ? await trySelectAttempts(db, [
        {
          table: "payments",
          query: new URLSearchParams({
            select: "id,booking_id,status,provider,provider_payment_id",
            id: `eq.${q}`,
            limit: "1",
          }),
        },
      ])
    : [];

  for (const row of byIdRows) {
    const id = safeString(row.id);
    if (!id) continue;
    const subtitle = [safeString(row.status), safeString(row.provider), safeString(row.booking_id)]
      .filter(Boolean)
      .join(" | ");
    push({
      type: "payment",
      id,
      title: id,
      subtitle: subtitle || undefined,
      href: `/admin/payments/${encodeURIComponent(id)}`,
    });
  }

  if (remaining <= byIdRows.length) return;

  const providerRows = await trySelectAttempts(db, [
    {
      table: "payments",
      query: new URLSearchParams({
        select: "id,booking_id,status,provider,provider_payment_id",
        provider_payment_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    },
  ]);

  for (const row of providerRows.slice(0, remaining)) {
    const id = safeString(row.id);
    if (!id) continue;
    const providerPaymentId = safeString(row.provider_payment_id);
    const subtitle = [
      providerPaymentId ? `provider id: ${providerPaymentId}` : "",
      safeString(row.status),
      safeString(row.booking_id),
    ]
      .filter(Boolean)
      .join(" | ");
    push({
      type: "payment",
      id,
      title: id,
      subtitle: subtitle || undefined,
      href: `/admin/payments/${encodeURIComponent(id)}`,
    });
  }
}

async function searchRefunds(
  db: SupabaseRestClient,
  q: string,
  remaining: number,
  push: (result: AdminSearchResult) => void
) {
  if (remaining <= 0) return;

  const mapRefund = (row: GenericRow): AdminSearchResult | null => {
    const id = safeString(row.id);
    if (!id) return null;
    const subtitle = [
      safeString(row.status),
      safeString(row.provider_refund_id),
      safeString(row.booking_id),
    ]
      .filter(Boolean)
      .join(" | ");
    return {
      type: "refund",
      id,
      title: id,
      subtitle: subtitle || undefined,
      href: `/admin/refunds/${encodeURIComponent(id)}`,
    };
  };

  const byIdAttempts: Array<{ table: string; query: URLSearchParams }> = isUuidLike(q)
    ? [
        {
          table: "refunds",
          query: new URLSearchParams({
            select: "id,booking_id,status,provider_refund_id",
            id: `eq.${q}`,
            limit: "1",
          }),
        },
        {
          table: "payment_refunds",
          query: new URLSearchParams({
            select: "id,booking_id,status,provider_refund_id",
            id: `eq.${q}`,
            limit: "1",
          }),
        },
      ]
    : [];

  const byIdRows = byIdAttempts.length ? await trySelectAttempts(db, byIdAttempts) : [];
  for (const row of byIdRows) {
    const mapped = mapRefund(row);
    if (mapped) push(mapped);
  }

  const providerRows = await trySelectAttempts(db, [
    {
      table: "refunds",
      query: new URLSearchParams({
        select: "id,booking_id,status,provider_refund_id",
        provider_refund_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    },
    {
      table: "payment_refunds",
      query: new URLSearchParams({
        select: "id,booking_id,status,provider_refund_id",
        provider_refund_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    },
  ]);

  for (const row of providerRows.slice(0, remaining)) {
    const mapped = mapRefund(row);
    if (mapped) push(mapped);
  }
}

async function searchDocuments(
  db: SupabaseRestClient,
  q: string,
  remaining: number,
  push: (result: AdminSearchResult) => void
) {
  if (remaining <= 0) return;

  const mapDoc = (row: GenericRow): AdminSearchResult | null => {
    const id = safeString(row.id);
    const bookingId = safeString(row.booking_id);
    const type = safeString(row.type);
    const name =
      safeString(row.name) ||
      safeString(row.file_name) ||
      safeString(row.document_name) ||
      type ||
      id;
    const href = bookingId
      ? `/admin/documents?booking_id=${encodeURIComponent(bookingId)}`
      : "/admin/documents";
    const subtitle = [type, bookingId].filter(Boolean).join(" | ");
    if (!id && !bookingId) return null;
    return {
      type: "document",
      id: id || bookingId || name,
      title: name || "Document",
      subtitle: subtitle || undefined,
      href,
    };
  };

  const attempts: Array<{ table: string; query: URLSearchParams }> = [];
  if (isUuidLike(q)) {
    attempts.push(
      {
        table: "documents",
        query: new URLSearchParams({
          select: "id,booking_id,type,name",
          id: `eq.${q}`,
          limit: "1",
        }),
      },
      {
        table: "booking_documents",
        query: new URLSearchParams({
          select: "id,booking_id,type,name",
          id: `eq.${q}`,
          limit: "1",
        }),
      }
    );
  }
  attempts.push(
    {
      table: "documents",
      query: new URLSearchParams({
        select: "id,booking_id,type,name",
        booking_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    },
    {
      table: "documents",
      query: new URLSearchParams({
        select: "id,booking_id,type,name",
        name: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    },
    {
      table: "booking_documents",
      query: new URLSearchParams({
        select: "id,booking_id,type,name,file_name",
        booking_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    }
  );

  const rows = await trySelectAttempts(db, attempts);
  for (const row of rows.slice(0, remaining)) {
    const mapped = mapDoc(row);
    if (mapped) push(mapped);
  }
}

async function searchSupplierLogs(
  db: SupabaseRestClient,
  q: string,
  remaining: number,
  push: (result: AdminSearchResult) => void
) {
  if (remaining <= 0) return;

  const mapLog = (row: GenericRow): AdminSearchResult | null => {
    const id = safeString(row.id);
    if (!id) return null;
    const bookingId = safeString(row.booking_id);
    const supplier = safeString(row.supplier) || safeString(row.supplier_name) || safeString(row.provider);
    const action = safeString(row.action) || safeString(row.operation) || safeString(row.event);
    const subtitle = [supplier, action, bookingId].filter(Boolean).join(" | ");
    return {
      type: "supplier_log",
      id,
      title: id,
      subtitle: subtitle || undefined,
      href: `/admin/suppliers/logs/${encodeURIComponent(id)}`,
    };
  };

  const attempts: Array<{ table: string; query: URLSearchParams }> = [];
  if (isUuidLike(q)) {
    attempts.push(
      {
        table: "supplier_logs",
        query: new URLSearchParams({
          select: "id,booking_id,supplier,action",
          id: `eq.${q}`,
          limit: "1",
        }),
      },
      {
        table: "supplier_api_logs",
        query: new URLSearchParams({
          select: "id,booking_id,provider,operation",
          id: `eq.${q}`,
          limit: "1",
        }),
      }
    );
  }
  attempts.push(
    {
      table: "supplier_logs",
      query: new URLSearchParams({
        select: "id,booking_id,supplier,action",
        booking_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    },
    {
      table: "supplier_api_logs",
      query: new URLSearchParams({
        select: "id,booking_id,provider,operation",
        booking_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    }
  );

  const rows = await trySelectAttempts(db, attempts);
  for (const row of rows.slice(0, remaining)) {
    const mapped = mapLog(row);
    if (mapped) push(mapped);
  }
}

async function searchAutomationFailures(
  db: SupabaseRestClient,
  q: string,
  remaining: number,
  push: (result: AdminSearchResult) => void
) {
  if (remaining <= 0) return;

  const mapFailure = (row: GenericRow): AdminSearchResult | null => {
    const id = safeString(row.id);
    if (!id) return null;
    const bookingId = safeString(row.booking_id);
    const event = safeString(row.event) || safeString(row.event_name) || safeString(row.trigger_event);
    const status = safeString(row.status) || safeString(row.level);
    const subtitle = [event, status, bookingId].filter(Boolean).join(" | ");
    return {
      type: "automation_failure",
      id,
      title: id,
      subtitle: subtitle || undefined,
      href: `/admin/automation/failures/${encodeURIComponent(id)}`,
    };
  };

  const attempts: Array<{ table: string; query: URLSearchParams }> = [];
  if (isUuidLike(q)) {
    attempts.push(
      {
        table: "event_failures",
        query: new URLSearchParams({
          select: "id,booking_id,event,status",
          id: `eq.${q}`,
          limit: "1",
        }),
      },
      {
        table: "automation_failures",
        query: new URLSearchParams({
          select: "id,booking_id,event,status",
          id: `eq.${q}`,
          limit: "1",
        }),
      }
    );
  }

  attempts.push(
    {
      table: "event_failures",
      query: new URLSearchParams({
        select: "id,booking_id,event,status",
        booking_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    },
    {
      table: "automation_failures",
      query: new URLSearchParams({
        select: "id,booking_id,event,status",
        booking_id: ilike(q),
        order: "created_at.desc",
        limit: String(Math.min(2, remaining)),
      }),
    }
  );

  const rows = await trySelectAttempts(db, attempts);
  for (const row of rows.slice(0, remaining)) {
    const mapped = mapFailure(row);
    if (mapped) push(mapped);
  }
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const url = new URL(req.url);
    const q = safeString(url.searchParams.get("q"));
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!q) {
      return NextResponse.json({ q: "", results: [] });
    }

    const db = new SupabaseRestClient();
    const results: AdminSearchResult[] = [];
    const dedupe = new Set<string>();
    const push = (result: AdminSearchResult) => pushResult(results, dedupe, result, limit);

    const remaining = () => Math.max(0, limit - results.length);

    await searchBookings(db, q, remaining(), push);
    await searchPayments(db, q, remaining(), push);
    await searchRefunds(db, q, remaining(), push);
    await searchDocuments(db, q, remaining(), push);
    await searchSupplierLogs(db, q, remaining(), push);
    await searchAutomationFailures(db, q, remaining(), push);

    return NextResponse.json({ q, results: results.slice(0, limit) });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      const url = new URL(req.url);
      return NextResponse.json({ q: safeString(url.searchParams.get("q")), results: [] });
    }
    return routeError(500, "Failed to search admin data");
  }
}
