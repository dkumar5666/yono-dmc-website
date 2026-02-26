import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

interface WebhookEventRowRaw {
  id?: string | null;
  provider?: string | null;
  event_id?: string | null;
  event_type?: string | null;
  status?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  created_at?: string | null;
}

interface WebhookEventListRow {
  id?: string | null;
  provider?: string | null;
  event_id?: string | null;
  event_type?: string | null;
  status?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  created_at?: string | null;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

async function fetchWebhookEventRows(
  db: SupabaseRestClient,
  query: URLSearchParams
): Promise<WebhookEventRowRaw[]> {
  const attempts = [
    query,
    new URLSearchParams({
      ...Object.fromEntries(query.entries()),
      select: "id,provider,event_id,status,created_at",
    }),
  ];

  for (const attempt of attempts) {
    const rows = await safeSelectMany<WebhookEventRowRaw>(db, "webhook_events", attempt);
    if (rows.length > 0) return rows;
  }

  return [];
}

function qMatches(row: WebhookEventListRow, q: string): boolean {
  if (!q) return true;
  const haystack = [
    row.id,
    row.provider,
    row.event_id,
    row.event_type,
    row.status,
    row.booking_id,
    row.payment_id,
  ]
    .map((value) => safeString(value).toLowerCase())
    .join(" ");
  return haystack.includes(q);
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);

    const provider = safeString(url.searchParams.get("provider")).toLowerCase();
    const status = safeString(url.searchParams.get("status")).toLowerCase();
    const eventType = (
      safeString(url.searchParams.get("event_type")) || safeString(url.searchParams.get("event"))
    ).toLowerCase();
    const bookingId = safeString(url.searchParams.get("booking_id"));
    const paymentId = safeString(url.searchParams.get("payment_id"));
    const q = safeString(url.searchParams.get("q")).toLowerCase();
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const query = new URLSearchParams({
      select: "id,provider,event_id,event_type,status,booking_id,payment_id,created_at",
      order: "created_at.desc",
      limit: "500",
    });

    if (provider && provider !== "all") query.set("provider", `eq.${provider}`);
    if (status && status !== "all") query.set("status", `eq.${status}`);
    if (bookingId) query.set("booking_id", `eq.${bookingId}`);
    if (paymentId) query.set("payment_id", `eq.${paymentId}`);
    if (eventType) query.set("event_type", `ilike.*${eventType.replaceAll("*", "")}*`);

    const rowsRaw = await fetchWebhookEventRows(db, query);
    const normalized = rowsRaw
      .map<WebhookEventListRow>((row) => ({
        id: safeString(row.id) || null,
        provider: safeString(row.provider) || null,
        event_id: safeString(row.event_id) || null,
        event_type: safeString(row.event_type) || null,
        status: safeString(row.status) || null,
        booking_id: safeString(row.booking_id) || null,
        payment_id: safeString(row.payment_id) || null,
        created_at: row.created_at ?? null,
      }))
      .filter((row) => qMatches(row, q))
      .sort((a, b) => {
        const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTs - aTs;
      });

    const total = normalized.length;
    const rows = normalized.slice(offset, offset + limit);
    return NextResponse.json({ rows, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }
    return routeError(500, "Failed to load webhook events");
  }
}
