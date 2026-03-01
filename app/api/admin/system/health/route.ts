import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { getSupabaseConfig, SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { getAmadeusConfig } from "@/lib/config/amadeus";

interface SystemHealthResponse {
  lastCronRetryAt: string | null;
  lastPaymentWebhookAt: string | null;
  failures24h: number;
  pendingSupport: number;
  missingDocuments: number;
  webhookEvents24h: number;
  webhookSkipped24h: number;
  integrationStatus: {
    cronRetry: "ok" | "stale" | "unknown";
    paymentWebhook: "ok" | "stale" | "unknown";
    amadeus: "ok" | "failed" | "skipped";
    storage: "ok" | "failed" | "skipped";
  };
}

interface GenericRow {
  [key: string]: unknown;
}

interface DocumentMetricRow {
  id?: string | null;
  public_url?: string | null;
  url?: string | null;
  file_url?: string | null;
  status?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  created_at?: string | null;
}

const EMPTY_RESPONSE: SystemHealthResponse = {
  lastCronRetryAt: null,
  lastPaymentWebhookAt: null,
  failures24h: 0,
  pendingSupport: 0,
  missingDocuments: 0,
  webhookEvents24h: 0,
  webhookSkipped24h: 0,
  integrationStatus: {
    cronRetry: "unknown",
    paymentWebhook: "unknown",
    amadeus: "skipped",
    storage: "skipped",
  },
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isStale(value: string | null, minutes: number): boolean | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts > minutes * 60 * 1000;
}

function mapFreshness(value: string | null, staleMinutes: number): "ok" | "stale" | "unknown" {
  const stale = isStale(value, staleMinutes);
  if (stale === null) return "unknown";
  return stale ? "stale" : "ok";
}

async function safeSelectMany<T>(db: SupabaseRestClient, table: string, query: URLSearchParams): Promise<T[]> {
  try {
    return await db.selectMany<T>(table, query);
  } catch {
    return [];
  }
}

async function safeCountByQuery(db: SupabaseRestClient, table: string, query: URLSearchParams): Promise<number> {
  const rows = await safeSelectMany<{ id?: string | null }>(db, table, query);
  return rows.length;
}

async function getLatestHeartbeat(db: SupabaseRestClient, kind: "cron_retry" | "payment_webhook" | "supplier_sync") {
  const heartbeatRow = await safeSelectMany<GenericRow>(
    db,
    "system_heartbeats",
    new URLSearchParams({
      select: "kind,created_at",
      kind: `eq.${kind}`,
      order: "created_at.desc",
      limit: "1",
    })
  );
  const createdAt = safeString(heartbeatRow[0]?.created_at);
  if (createdAt) return createdAt;

  const logAttempts: URLSearchParams[] = [
    new URLSearchParams({
      select: "created_at,event,message",
      event: "eq.heartbeat",
      message: `eq.${kind}`,
      order: "created_at.desc",
      limit: "1",
    }),
    new URLSearchParams({
      select: "created_at,level,event,message",
      order: "created_at.desc",
      limit: "50",
    }),
  ];

  for (const query of logAttempts) {
    const rows = await safeSelectMany<GenericRow>(db, "system_logs", query);
    if (rows.length === 0) continue;

    if (query.get("event")) {
      const directCreated = safeString(rows[0]?.created_at);
      if (directCreated) return directCreated;
      continue;
    }

    const matched = rows.find((row) => {
      const event = safeString(row.event).toLowerCase();
      const message = safeString(row.message);
      return event === "heartbeat" && message === kind;
    });
    const fallbackCreated = safeString(matched?.created_at);
    if (fallbackCreated) return fallbackCreated;
  }

  return null;
}

async function getFailures24h(db: SupabaseRestClient): Promise<number> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const candidates = [
    {
      table: "automation_failures",
      query: new URLSearchParams({ select: "id", created_at: `gte.${sinceIso}` }),
    },
    {
      table: "event_failures",
      query: new URLSearchParams({ select: "id", created_at: `gte.${sinceIso}` }),
    },
  ];

  let total = 0;
  for (const candidate of candidates) {
    total += await safeCountByQuery(db, candidate.table, candidate.query);
  }

  return total;
}

async function getPendingSupport(db: SupabaseRestClient): Promise<number> {
  const supportTables = ["support_requests", "customer_requests", "helpdesk_tickets"] as const;
  for (const table of supportTables) {
    const count = await safeCountByQuery(
      db,
      table,
      new URLSearchParams({
        select: "id",
        status: "eq.open",
      })
    );
    if (count > 0) return count;
  }
  return 0;
}

function isRecentWithinDays(value: string | null | undefined, days: number): boolean {
  const iso = (value ?? "").trim();
  if (!iso) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function isMissingDocumentMetricRow(row: DocumentMetricRow): boolean {
  const url = (row.public_url ?? row.url ?? row.file_url ?? "").trim();
  const fileRef = (row.storage_path ?? row.file_path ?? "").trim();
  const status = (row.status ?? "").trim().toLowerCase();
  return !url || !fileRef || status === "pending" || status === "failed";
}

async function getMissingDocumentsCount(db: SupabaseRestClient): Promise<number> {
  const attempts: Array<{ table: string; select: string }> = [
    { table: "documents", select: "id,public_url,status,storage_path,created_at" },
    { table: "documents", select: "id,url,status,storage_path,created_at" },
    { table: "documents", select: "id,public_url,storage_path,created_at" },
    { table: "booking_documents", select: "id,url,status,file_path,created_at" },
    { table: "booking_documents", select: "id,file_url,status,file_path,created_at" },
  ];

  for (const attempt of attempts) {
    const rows = await safeSelectMany<DocumentMetricRow>(
      db,
      attempt.table,
      new URLSearchParams({
        select: attempt.select,
        order: "created_at.desc",
        limit: "500",
      })
    );
    if (rows.length === 0) continue;
    return rows.filter((row) => isRecentWithinDays(row.created_at, 30) && isMissingDocumentMetricRow(row)).length;
  }

  return 0;
}

async function getWebhookEventStats24h(
  db: SupabaseRestClient
): Promise<{ webhookEvents24h: number; webhookSkipped24h: number }> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const allCount = await safeCountByQuery(
    db,
    "webhook_events",
    new URLSearchParams({
      select: "id",
      created_at: `gte.${sinceIso}`,
    })
  );

  const skippedCount = await safeCountByQuery(
    db,
    "webhook_events",
    new URLSearchParams({
      select: "id",
      created_at: `gte.${sinceIso}`,
      status: "eq.skipped",
    })
  );

  if (allCount === 0 && skippedCount === 0) {
    // Table may not exist or no rows. Both are acceptable fallbacks.
    return { webhookEvents24h: 0, webhookSkipped24h: 0 };
  }

  return { webhookEvents24h: allCount, webhookSkipped24h: skippedCount };
}

async function testAmadeusTokenPing(): Promise<"ok" | "failed" | "skipped"> {
  let config: ReturnType<typeof getAmadeusConfig> | null = null;
  try {
    config = getAmadeusConfig();
  } catch {
    return "skipped";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const tokenRes = await fetch(`${config.baseUrl}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!tokenRes.ok) return "failed";
    const json = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    return json.access_token ? "ok" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

async function testStorageAccess(): Promise<"ok" | "failed" | "skipped"> {
  const config = getSupabaseConfig();
  if (!config) return "skipped";

  const bucket = (process.env.DOCUMENTS_STORAGE_BUCKET || "documents").trim();
  if (!bucket) return "skipped";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${config.url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 1 }),
      signal: controller.signal,
      cache: "no-store",
    });
    return response.ok ? "ok" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const [
      lastCronRetryAt,
      lastPaymentWebhookAt,
      failures24h,
      pendingSupport,
      missingDocuments,
      webhookStats,
      amadeusStatus,
      storageStatus,
    ] =
      await Promise.all([
        getLatestHeartbeat(db, "cron_retry"),
        getLatestHeartbeat(db, "payment_webhook"),
        getFailures24h(db),
        getPendingSupport(db),
        getMissingDocumentsCount(db),
        getWebhookEventStats24h(db),
        testAmadeusTokenPing(),
        testStorageAccess(),
      ]);

    return NextResponse.json<SystemHealthResponse>({
      lastCronRetryAt,
      lastPaymentWebhookAt,
      failures24h,
      pendingSupport,
      missingDocuments,
      webhookEvents24h: webhookStats.webhookEvents24h,
      webhookSkipped24h: webhookStats.webhookSkipped24h,
      integrationStatus: {
        cronRetry: mapFreshness(lastCronRetryAt, 15),
        paymentWebhook: mapFreshness(lastPaymentWebhookAt, 60),
        amadeus: amadeusStatus,
        storage: storageStatus,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json<SystemHealthResponse>(EMPTY_RESPONSE);
    }
    return routeError(500, "Failed to load system health");
  }
}
