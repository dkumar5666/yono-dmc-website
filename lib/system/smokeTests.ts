import "server-only";

import { getAppMode, type AppMode } from "@/lib/config/appMode";
import { getSupabaseConfig, SupabaseRestClient } from "@/lib/core/supabase-rest";

export type SmokeCheckStatus = "pass" | "warn" | "fail";

export interface SmokeCheckResult {
  name: string;
  status: SmokeCheckStatus;
  detail: string;
  action?: string;
}

export interface SmokeTestResult {
  ok: boolean;
  checks: SmokeCheckResult[];
  meta: {
    timestamp: string;
    appMode: AppMode;
  };
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

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function has(name: string): boolean {
  return Boolean(safeString(process.env[name]));
}

function getHeaderHost(req: Request): string {
  const forwarded = safeString(req.headers.get("x-forwarded-host"));
  if (forwarded) return forwarded;
  return safeString(req.headers.get("host"));
}

function getSiteHost(): string {
  const siteUrl = safeString(process.env.SITE_URL);
  if (!siteUrl) return "";
  try {
    return new URL(siteUrl).host.toLowerCase();
  } catch {
    return "";
  }
}

function getSiteOrigin(): string {
  const siteUrl = safeString(process.env.SITE_URL);
  if (!siteUrl) return "";
  try {
    return new URL(siteUrl).origin.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function ageMs(value: string | null): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts;
}

function formatAge(ms: number | null): string {
  if (ms === null) return "unknown age";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h ago`;
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

async function getLatestHeartbeat(
  db: SupabaseRestClient,
  kind: "cron_retry" | "payment_webhook"
): Promise<string | null> {
  const rows = await safeSelectMany<{ created_at?: string | null }>(
    db,
    "system_heartbeats",
    new URLSearchParams({
      select: "created_at,kind",
      kind: `eq.${kind}`,
      order: "created_at.desc",
      limit: "1",
    })
  );
  const direct = safeString(rows[0]?.created_at);
  if (direct) return direct;

  const fallback = await safeSelectMany<{ created_at?: string | null }>(
    db,
    "system_logs",
    new URLSearchParams({
      select: "created_at,event,message",
      event: "eq.heartbeat",
      message: `eq.${kind}`,
      order: "created_at.desc",
      limit: "1",
    })
  );
  return safeString(fallback[0]?.created_at) || null;
}

async function getFailedAutomations24h(db: SupabaseRestClient): Promise<number> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tables = ["automation_failures", "event_failures"] as const;
  let total = 0;

  for (const table of tables) {
    const rows = await safeSelectMany<{ id?: string | null }>(
      db,
      table,
      new URLSearchParams({
        select: "id",
        status: "eq.failed",
        created_at: `gte.${sinceIso}`,
      })
    );
    total += rows.length;
  }
  return total;
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
    if (rows.length > 0) {
      return rows.filter((row) => isRecentWithinDays(row.created_at, 30) && isMissingDocumentMetricRow(row)).length;
    }
  }

  return 0;
}

async function tableExists(db: SupabaseRestClient, table: string, select = "id"): Promise<boolean> {
  try {
    await db.selectMany<Record<string, unknown>>(
      table,
      new URLSearchParams({
        select,
        limit: "1",
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function checkSupplierAssignmentIntegrity(db: SupabaseRestClient): Promise<SmokeCheckResult> {
  const sources: Array<{
    table: string;
    select: string;
    notNullField?: string;
  }> = [
    {
      table: "supplier_assignments",
      select: "booking_id,supplier_id,created_at",
      notNullField: "supplier_id",
    },
    {
      table: "booking_items",
      select: "booking_id,supplier_id,created_at",
      notNullField: "supplier_id",
    },
    {
      table: "ground_services",
      select: "booking_id,supplier_id,created_at",
      notNullField: "supplier_id",
    },
    {
      table: "bookings",
      select: "booking_id,supplier_id,created_at",
      notNullField: "supplier_id",
    },
  ];

  for (const source of sources) {
    try {
      const query = new URLSearchParams({
        select: source.select,
        order: "created_at.desc",
        limit: "100",
      });
      if (source.notNullField) {
        query.set(source.notNullField, "not.is.null");
      }
      const rows = await db.selectMany<Record<string, unknown>>(source.table, query);
      const invalid = rows.filter((row) => {
        const bookingId = safeString(row.booking_id);
        const supplierId = safeString(row.supplier_id);
        return !bookingId || !supplierId;
      }).length;

      if (rows.length === 0) {
        return {
          name: "Supplier assignments integrity",
          status: "warn",
          detail: `No supplier assignment rows found in ${source.table}.`,
          action: "Verify supplier assignment linkage before supplier portal rollout.",
        };
      }

      if (invalid > 0) {
        return {
          name: "Supplier assignments integrity",
          status: "warn",
          detail: `${invalid} assignment rows in ${source.table} have missing booking_id or supplier_id.`,
          action: "Clean up incomplete supplier assignment rows.",
        };
      }

      return {
        name: "Supplier assignments integrity",
        status: "pass",
        detail: `Supplier assignments validated via ${source.table} (${rows.length} sampled rows).`,
      };
    } catch {
      // Try next source table.
    }
  }

  return {
    name: "Supplier assignments integrity",
    status: "warn",
    detail: "No supplier assignment source table is available.",
    action: "Ensure supplier_assignments (or equivalent supplier linkage columns) exists.",
  };
}

async function testStorageAccess(): Promise<boolean | null> {
  const config = getSupabaseConfig();
  if (!config) return null;
  const bucket = (process.env.DOCUMENTS_STORAGE_BUCKET || "documents").trim();
  if (!bucket) return null;

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
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function authConfigFlags(): {
  hasGoogleOAuth: boolean;
  hasSupabasePublicAuth: boolean;
  hasTwilioOtp: boolean;
  hasOtpConfig: boolean;
  hasSiteUrl: boolean;
} {
  const hasGoogleOAuth = has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET");
  const hasSupabasePublicAuth = has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const hasTwilioOtp =
    has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN") && has("TWILIO_VERIFY_SERVICE_SID");
  return {
    hasGoogleOAuth,
    hasSupabasePublicAuth,
    hasTwilioOtp,
    hasOtpConfig: hasSupabasePublicAuth || hasTwilioOtp,
    hasSiteUrl: has("SITE_URL"),
  };
}

function checkLoginFlowConfig(flags: ReturnType<typeof authConfigFlags>): SmokeCheckResult {
  if (flags.hasSupabasePublicAuth && flags.hasSiteUrl) {
    return {
      name: "Login flow config",
      status: "pass",
      detail: "SITE_URL and Supabase public auth settings are present.",
    };
  }
  return {
    name: "Login flow config",
    status: "warn",
    detail: `hasSiteUrl=${flags.hasSiteUrl}, hasSupabasePublicAuth=${flags.hasSupabasePublicAuth}`,
    action: "Set SITE_URL, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  };
}

function checkOtpProviderConfig(flags: ReturnType<typeof authConfigFlags>): SmokeCheckResult {
  if (flags.hasTwilioOtp || flags.hasSupabasePublicAuth) {
    const provider = flags.hasTwilioOtp ? "twilio_verify" : "supabase_phone";
    return {
      name: "OTP provider status",
      status: "pass",
      detail: `OTP provider config detected (${provider}).`,
    };
  }
  return {
    name: "OTP provider status",
    status: "warn",
    detail: "No OTP provider configuration detected.",
    action: "Configure Twilio Verify or Supabase phone OTP settings.",
  };
}

function checkGoogleRedirectMismatch(
  req: Request,
  flags: ReturnType<typeof authConfigFlags>
): SmokeCheckResult {
  if (!flags.hasGoogleOAuth && !flags.hasSupabasePublicAuth) {
    return {
      name: "Google OAuth redirect alignment",
      status: "warn",
      detail: "Google OAuth configuration is missing.",
      action: "Set Google OAuth credentials/provider before launch.",
    };
  }

  const siteOrigin = getSiteOrigin();
  if (!siteOrigin) {
    return {
      name: "Google OAuth redirect alignment",
      status: "warn",
      detail: "SITE_URL is missing or invalid, redirect URI cannot be verified.",
      action: "Set SITE_URL to the canonical production origin.",
    };
  }

  const expectedLegacy = `${siteOrigin}/api/customer-auth/google/callback`;
  const expectedSupabase = `${siteOrigin}/auth/callback`;
  const configured =
    safeString(process.env.GOOGLE_OAUTH_REDIRECT_URI) ||
    safeString(process.env.GOOGLE_REDIRECT_URI);

  if (configured && configured !== expectedLegacy && configured !== expectedSupabase) {
    return {
      name: "Google OAuth redirect alignment",
      status: "warn",
      detail: "Configured Google redirect URI does not match canonical SITE_URL callback paths.",
      action: `Use ${expectedSupabase} (Supabase) or ${expectedLegacy} (legacy callback).`,
    };
  }

  const requestHost = getHeaderHost(req).toLowerCase();
  const siteHost = getSiteHost();
  if (requestHost && siteHost && requestHost !== siteHost) {
    return {
      name: "Google OAuth redirect alignment",
      status: "warn",
      detail: `Request host (${requestHost}) differs from SITE_URL host (${siteHost}).`,
      action: "Use canonical domain redirects and ensure Google redirect URIs include canonical host.",
    };
  }

  return {
    name: "Google OAuth redirect alignment",
    status: "pass",
    detail: `OAuth callbacks align with SITE_URL (${siteOrigin}).`,
  };
}

function checkAmadeusSanity(appMode: AppMode): SmokeCheckResult {
  const env = safeString(process.env.AMADEUS_ENV).toLowerCase();
  const baseUrl = safeString(process.env.AMADEUS_BASE_URL).toLowerCase();
  if (!env || !baseUrl) {
    return {
      name: "Amadeus config sanity",
      status: "warn",
      detail: "AMADEUS_ENV or AMADEUS_BASE_URL is missing.",
      action: "Set AMADEUS_ENV and AMADEUS_BASE_URL in Vercel.",
    };
  }

  if (appMode === "staging" && !baseUrl.includes("test.api")) {
    return {
      name: "Amadeus config sanity",
      status: "warn",
      detail: "Staging mode is active but AMADEUS_BASE_URL is not using test.api host.",
      action: "Use sandbox base URL for staging.",
    };
  }

  if (appMode === "production" && !baseUrl.includes("api")) {
    return {
      name: "Amadeus config sanity",
      status: "warn",
      detail: "Production mode base URL does not look like an Amadeus API host.",
      action: "Verify AMADEUS_BASE_URL for production deployment.",
    };
  }

  return {
    name: "Amadeus config sanity",
    status: "pass",
    detail: `AMADEUS_ENV=${env} with valid base URL shape.`,
  };
}

export async function runSystemSmokeTests(req: Request): Promise<SmokeTestResult> {
  const checks: SmokeCheckResult[] = [];
  const appMode = getAppMode();

  let db: SupabaseRestClient | null = null;
  try {
    db = new SupabaseRestClient();
    await db.selectMany<{ id?: string | null }>(
      "system_logs",
      new URLSearchParams({ select: "id", limit: "1" })
    );
    checks.push({
      name: "Supabase connectivity",
      status: "pass",
      detail: "Server can query Supabase successfully.",
    });
  } catch {
    checks.push({
      name: "Supabase connectivity",
      status: "fail",
      detail: "Failed to query Supabase (system_logs).",
      action: "Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then test DB reachability.",
    });
  }

  const storageOk = await testStorageAccess();
  if (storageOk === true) {
    checks.push({
      name: "Storage access",
      status: "pass",
      detail: "Storage bucket listing is reachable.",
    });
  } else if (storageOk === false) {
    checks.push({
      name: "Storage access",
      status: "warn",
      detail: "Could not access storage bucket listing.",
      action: "Verify storage bucket exists and service role permissions are correct.",
    });
  } else {
    checks.push({
      name: "Storage access",
      status: "warn",
      detail: "Storage check skipped because Supabase server config is missing.",
      action: "Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  if (db) {
    const webhookHeartbeat = await getLatestHeartbeat(db, "payment_webhook");
    const webhookAge = ageMs(webhookHeartbeat);
    const webhookOver2h = webhookAge !== null && webhookAge > 2 * 60 * 60 * 1000;
    const webhookOver24h = webhookAge !== null && webhookAge > 24 * 60 * 60 * 1000;

    if (!webhookHeartbeat) {
      checks.push({
        name: "Razorpay webhook freshness",
        status: "warn",
        detail: "No payment webhook heartbeat found.",
        action: "Trigger a test webhook and verify heartbeat logging.",
      });
    } else if (appMode === "production" && webhookOver24h) {
      checks.push({
        name: "Razorpay webhook freshness",
        status: "fail",
        detail: `Last heartbeat is stale (${formatAge(webhookAge)}).`,
        action: "Check Razorpay webhook delivery and endpoint health immediately.",
      });
    } else if (webhookOver2h) {
      checks.push({
        name: "Razorpay webhook freshness",
        status: "warn",
        detail: `Last heartbeat is stale (${formatAge(webhookAge)}).`,
        action: "Review webhook endpoint and delivery logs.",
      });
    } else {
      checks.push({
        name: "Razorpay webhook freshness",
        status: "pass",
        detail: `Heartbeat is fresh (${formatAge(webhookAge)}).`,
      });
    }

    const cronHeartbeat = await getLatestHeartbeat(db, "cron_retry");
    const cronAge = ageMs(cronHeartbeat);
    const cronOver30m = cronAge !== null && cronAge > 30 * 60 * 1000;
    const cronOver2h = cronAge !== null && cronAge > 2 * 60 * 60 * 1000;

    if (!cronHeartbeat) {
      checks.push({
        name: "Cron retry freshness",
        status: "warn",
        detail: "No cron retry heartbeat found.",
        action: "Trigger retry endpoint once and confirm cron schedule is configured.",
      });
    } else if (cronOver2h) {
      checks.push({
        name: "Cron retry freshness",
        status: "fail",
        detail: `Cron heartbeat is stale (${formatAge(cronAge)}).`,
        action: "Check Vercel cron configuration and internal key authorization.",
      });
    } else if (cronOver30m) {
      checks.push({
        name: "Cron retry freshness",
        status: "warn",
        detail: `Cron heartbeat is aging (${formatAge(cronAge)}).`,
        action: "Investigate scheduler delays before launch.",
      });
    } else {
      checks.push({
        name: "Cron retry freshness",
        status: "pass",
        detail: `Cron heartbeat is fresh (${formatAge(cronAge)}).`,
      });
    }

    const failedAutomations24h = await getFailedAutomations24h(db);
    const failThreshold = Number(process.env.SMOKE_FAIL_AUTOMATIONS_THRESHOLD ?? "20");
    if (failedAutomations24h > failThreshold) {
      checks.push({
        name: "Failed automations",
        status: "fail",
        detail: `${failedAutomations24h} failures in last 24h (threshold ${failThreshold}).`,
        action: "Resolve failures queue before production traffic.",
      });
    } else if (failedAutomations24h > 0) {
      checks.push({
        name: "Failed automations",
        status: "warn",
        detail: `${failedAutomations24h} failures in last 24h.`,
        action: "Review /admin/automation/failures and resolve pending issues.",
      });
    } else {
      checks.push({
        name: "Failed automations",
        status: "pass",
        detail: "No failed automations detected in last 24h.",
      });
    }

    const missingDocuments = await getMissingDocumentsCount(db);
    if (missingDocuments > 0) {
      checks.push({
        name: "Missing documents",
        status: "warn",
        detail: `${missingDocuments} documents are pending/failed or missing URLs.`,
        action: "Review /admin/documents?missing_only=1 and retry document generation.",
      });
    } else {
      checks.push({
        name: "Missing documents",
        status: "pass",
        detail: "No missing document records found.",
      });
    }

    const hasWebhookIdempotencyTable = await tableExists(db, "webhook_events", "id");
    checks.push(
      hasWebhookIdempotencyTable
        ? {
            name: "Webhook idempotency table",
            status: "pass",
            detail: "webhook_events table is present.",
          }
        : {
            name: "Webhook idempotency table",
            status: "warn",
            detail: "webhook_events table is missing or inaccessible.",
            action: "Apply webhook idempotency migration and verify table access.",
          }
    );

    checks.push(await checkSupplierAssignmentIntegrity(db));
  } else {
    checks.push({
      name: "Razorpay webhook freshness",
      status: "warn",
      detail: "Skipped because Supabase connectivity failed.",
      action: "Fix Supabase connectivity first.",
    });
    checks.push({
      name: "Cron retry freshness",
      status: "warn",
      detail: "Skipped because Supabase connectivity failed.",
      action: "Fix Supabase connectivity first.",
    });
    checks.push({
      name: "Failed automations",
      status: "warn",
      detail: "Skipped because Supabase connectivity failed.",
      action: "Fix Supabase connectivity first.",
    });
    checks.push({
      name: "Missing documents",
      status: "warn",
      detail: "Skipped because Supabase connectivity failed.",
      action: "Fix Supabase connectivity first.",
    });
    checks.push({
      name: "Webhook idempotency table",
      status: "warn",
      detail: "Skipped because Supabase connectivity failed.",
      action: "Fix Supabase connectivity first.",
    });
    checks.push({
      name: "Supplier assignments integrity",
      status: "warn",
      detail: "Skipped because Supabase connectivity failed.",
      action: "Fix Supabase connectivity first.",
    });
  }

  const authFlags = authConfigFlags();
  checks.push(checkLoginFlowConfig(authFlags));
  checks.push(checkOtpProviderConfig(authFlags));
  checks.push(checkGoogleRedirectMismatch(req, authFlags));

  const siteHost = getSiteHost();
  const requestHost = getHeaderHost(req).toLowerCase();
  if (!siteHost) {
    checks.push({
      name: "Domain canonical",
      status: "warn",
      detail: "SITE_URL is missing or invalid.",
      action: "Set SITE_URL to canonical production domain.",
    });
  } else if (requestHost && requestHost !== siteHost) {
    checks.push({
      name: "Domain canonical",
      status: "warn",
      detail: `Request host (${requestHost}) differs from SITE_URL host (${siteHost}).`,
      action: "Set canonical redirects and add matching OAuth redirect URIs.",
    });
  } else {
    checks.push({
      name: "Domain canonical",
      status: "pass",
      detail: `Canonical host is aligned (${siteHost}).`,
    });
  }

  checks.push(checkAmadeusSanity(appMode));

  const ok = !checks.some((check) => check.status === "fail");
  return {
    ok,
    checks,
    meta: {
      timestamp: new Date().toISOString(),
      appMode,
    },
  };
}
