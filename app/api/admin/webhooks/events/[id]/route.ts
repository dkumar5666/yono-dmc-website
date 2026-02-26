import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type Params = { id: string };

interface WebhookEventDetailRow {
  id?: string | null;
  provider?: string | null;
  event_id?: string | null;
  event_type?: string | null;
  status?: string | null;
 booking_id?: string | null;
  payment_id?: string | null;
  payload?: unknown;
  created_at?: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function safeSelectSingle<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T | null> {
  try {
    return await db.selectSingle<T>(table, query);
  } catch {
    return null;
  }
}

async function resolveWebhookEvent(db: SupabaseRestClient, id: string): Promise<WebhookEventDetailRow | null> {
  const selects = [
    "id,provider,event_id,event_type,status,booking_id,payment_id,payload,created_at",
    "id,provider,event_id,status,payload,created_at",
    "id,provider,event_id,event_type,status,created_at",
    "*",
  ];

  for (const select of selects) {
    const row = await safeSelectSingle<WebhookEventDetailRow>(
      db,
      "webhook_events",
      new URLSearchParams({
        select,
        id: `eq.${id}`,
      })
    );
    if (row) return row;
  }

  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in params ? await params : params;
    const id = decodeURIComponent(resolved.id ?? "").trim();
    if (!id) return NextResponse.json({ event: null });

    const db = new SupabaseRestClient();
    const row = await resolveWebhookEvent(db, id);
    if (!row) return NextResponse.json({ event: null });

    return NextResponse.json({
      event: {
        id: safeString(row.id) || null,
        provider: safeString(row.provider) || null,
        event_id: safeString(row.event_id) || null,
        event_type: safeString(row.event_type) || null,
        status: safeString(row.status) || null,
        booking_id: safeString(row.booking_id) || null,
        payment_id: safeString(row.payment_id) || null,
        payload: row.payload ?? null,
        created_at: row.created_at ?? null,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ event: null });
    }
    return routeError(500, "Failed to load webhook event details");
  }
}
