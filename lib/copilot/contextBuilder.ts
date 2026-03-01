import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

type GenericRow = Record<string, unknown>;

export interface CopilotFailureSummary {
  id: string;
  booking_id: string | null;
  event: string | null;
  status: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string | null;
}

export interface CopilotPaymentSummary {
  id: string;
  booking_id: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string | null;
}

export interface CopilotContextSummary {
  generatedAt: string;
  timezone: "Asia/Kolkata";
  metrics: {
    revenueToday: number;
    pendingPayments: number;
    missingDocuments: number;
    openSupportRequests: number;
    failedAutomations24h: number;
    retryingAutomations: number;
  };
  recentAutomationFailures: CopilotFailureSummary[];
  pendingPaymentRows: CopilotPaymentSummary[];
}

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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getISTDayWindowUtc(now = new Date()): { startUtc: string; endUtc: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!year || !month || !day) {
    const fallbackStart = new Date(now);
    fallbackStart.setUTCHours(0, 0, 0, 0);
    const fallbackEnd = new Date(now);
    fallbackEnd.setUTCHours(23, 59, 59, 999);
    return {
      startUtc: fallbackStart.toISOString(),
      endUtc: fallbackEnd.toISOString(),
    };
  }
  const offsetMinutes = 330;
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMinutes * 60_000;
  const endUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMinutes * 60_000;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
  };
}

async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    const rows = await db.selectMany<T>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function safeCountByQuery(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<number> {
  const rows = await safeSelectMany<GenericRow>(db, table, query);
  return rows.length;
}

async function getRevenueToday(db: SupabaseRestClient): Promise<number> {
  const dayWindow = getISTDayWindowUtc();
  const rows = await safeSelectMany<GenericRow>(
    db,
    "payments",
    new URLSearchParams({
      select: "amount,status,created_at",
      status: "in.(paid,captured)",
      and: `(created_at.gte.${dayWindow.startUtc},created_at.lte.${dayWindow.endUtc})`,
      limit: "500",
    })
  );
  return round2(
    rows.reduce((sum, row) => sum + (toNumber(row.amount) ?? 0), 0)
  );
}

async function getPendingPayments(
  db: SupabaseRestClient
): Promise<{ count: number; rows: CopilotPaymentSummary[] }> {
  const statuses = "in.(pending,created,requires_action,authorized)";
  const rows = await safeSelectMany<GenericRow>(
    db,
    "payments",
    new URLSearchParams({
      select: "id,booking_id,status,amount,currency_code,currency,created_at",
      status: statuses,
      order: "created_at.desc",
      limit: "5",
    })
  );
  const count = await safeCountByQuery(
    db,
    "payments",
    new URLSearchParams({
      select: "id",
      status: statuses,
      limit: "500",
    })
  );
  return {
    count,
    rows: rows.map((row) => ({
      id: safeString(row.id) || "unknown",
      booking_id: safeString(row.booking_id) || null,
      status: safeString(row.status) || null,
      amount: toNumber(row.amount),
      currency: safeString(row.currency_code) || safeString(row.currency) || "INR",
      created_at: safeString(row.created_at) || null,
    })),
  };
}

async function getMissingDocumentsCount(db: SupabaseRestClient): Promise<number> {
  const rows = await safeSelectMany<GenericRow>(
    db,
    "documents",
    new URLSearchParams({
      select: "id,url,status",
      limit: "1000",
      order: "created_at.desc",
    })
  );
  if (rows.length) {
    return rows.filter((row) => {
      const url = safeString(row.url);
      const status = safeString(row.status).toLowerCase();
      return !url || status === "pending" || status === "failed";
    }).length;
  }

  const fallback = await safeSelectMany<GenericRow>(
    db,
    "booking_documents",
    new URLSearchParams({
      select: "id,url,status",
      limit: "1000",
      order: "created_at.desc",
    })
  );
  return fallback.filter((row) => {
    const url = safeString(row.url);
    const status = safeString(row.status).toLowerCase();
    return !url || status === "pending" || status === "failed";
  }).length;
}

async function getOpenSupportRequests(db: SupabaseRestClient): Promise<number> {
  return safeCountByQuery(
    db,
    "support_requests",
    new URLSearchParams({
      select: "id",
      status: "eq.open",
      limit: "500",
    })
  );
}

async function getFailureMetrics(
  db: SupabaseRestClient
): Promise<{ failed24h: number; retrying: number; rows: CopilotFailureSummary[] }> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let rows = await safeSelectMany<GenericRow>(
    db,
    "automation_failures",
    new URLSearchParams({
      select: "id,booking_id,event,status,attempts,last_error,created_at",
      order: "created_at.desc",
      limit: "5",
    })
  );
  let failed24h = await safeCountByQuery(
    db,
    "automation_failures",
    new URLSearchParams({
      select: "id",
      status: "eq.failed",
      created_at: `gte.${sinceIso}`,
      limit: "500",
    })
  );
  let retrying = await safeCountByQuery(
    db,
    "automation_failures",
    new URLSearchParams({
      select: "id",
      status: "eq.retrying",
      limit: "500",
    })
  );

  if (!rows.length && failed24h === 0 && retrying === 0) {
    rows = await safeSelectMany<GenericRow>(
      db,
      "event_failures",
      new URLSearchParams({
        select: "id,booking_id,event,status,attempts,last_error,created_at",
        order: "created_at.desc",
        limit: "5",
      })
    );
    failed24h = await safeCountByQuery(
      db,
      "event_failures",
      new URLSearchParams({
        select: "id",
        status: "eq.failed",
        created_at: `gte.${sinceIso}`,
        limit: "500",
      })
    );
    retrying = await safeCountByQuery(
      db,
      "event_failures",
      new URLSearchParams({
        select: "id",
        status: "eq.retrying",
        limit: "500",
      })
    );
  }

  return {
    failed24h,
    retrying,
    rows: rows.map((row) => ({
      id: safeString(row.id) || "unknown",
      booking_id: safeString(row.booking_id) || null,
      event: safeString(row.event) || null,
      status: safeString(row.status) || null,
      attempts: Math.floor(toNumber(row.attempts) ?? 0),
      last_error: safeString(row.last_error) || null,
      created_at: safeString(row.created_at) || null,
    })),
  };
}

export async function buildCopilotContext(): Promise<CopilotContextSummary> {
  const fallback: CopilotContextSummary = {
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    metrics: {
      revenueToday: 0,
      pendingPayments: 0,
      missingDocuments: 0,
      openSupportRequests: 0,
      failedAutomations24h: 0,
      retryingAutomations: 0,
    },
    recentAutomationFailures: [],
    pendingPaymentRows: [],
  };

  try {
    const db = new SupabaseRestClient();
    const [revenueToday, pendingPayments, missingDocuments, openSupport, failures] =
      await Promise.all([
        getRevenueToday(db),
        getPendingPayments(db),
        getMissingDocumentsCount(db),
        getOpenSupportRequests(db),
        getFailureMetrics(db),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      metrics: {
        revenueToday,
        pendingPayments: pendingPayments.count,
        missingDocuments,
        openSupportRequests: openSupport,
        failedAutomations24h: failures.failed24h,
        retryingAutomations: failures.retrying,
      },
      recentAutomationFailures: failures.rows.slice(0, 5),
      pendingPaymentRows: pendingPayments.rows.slice(0, 5),
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return fallback;
    return fallback;
  }
}
