import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { countOpenSupportRequestsLast30Days } from "@/lib/backend/supportRequests";
import { routeError } from "@/lib/middleware/routeError";

interface PaymentAmountRow {
  amount?: number | string | null;
}

interface EventFailureRow {
  event?: string | null;
  reason?: string | null;
  error?: string | null;
  message?: string | null;
  created_at?: string | null;
}

interface SystemLogRow {
  level?: string | null;
  message?: string | null;
  created_at?: string | null;
}

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  customer_id?: string | null;
  lifecycle_status?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
}

interface CustomerRow {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface ControlCenterRecentBooking {
  booking_id: string;
  customer_name: string | null;
  status: string | null;
  created_at: string | null;
}

type ControlCenterAlertSeverity = "warn" | "error" | "info";

interface ControlCenterAlert {
  severity: ControlCenterAlertSeverity;
  message: string;
  created_at?: string;
}

interface ControlCenterResponse {
  revenueToday: number;
  activeBookings: number;
  pendingPayments: number;
  refundLiability: number;
  missingDocuments: number;
  openSupportRequests: number;
  failedAutomations24h: number;
  recentBookings: ControlCenterRecentBooking[];
  alerts: ControlCenterAlert[];
  dayWindow?: {
    tz: "Asia/Kolkata";
    startUtc: string;
    endUtc: string;
  };
}

const EMPTY_RESPONSE: ControlCenterResponse = {
  revenueToday: 0,
  activeBookings: 0,
  pendingPayments: 0,
  refundLiability: 0,
  missingDocuments: 0,
  openSupportRequests: 0,
  failedAutomations24h: 0,
  recentBookings: [],
  alerts: [],
};

function getISTDayWindowUtc(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    const fallbackStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const fallbackEnd = new Date(fallbackStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    return {
      tz: "Asia/Kolkata" as const,
      startUtc: fallbackStart.toISOString(),
      endUtc: fallbackEnd.toISOString(),
    };
  }

  // IST is UTC+05:30 and does not observe DST.
  const IST_OFFSET_MINUTES = 330;
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60_000;
  const endUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MINUTES * 60_000;

  return {
    tz: "Asia/Kolkata" as const,
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
    return await db.selectMany<T>(table, query);
  } catch {
    return [];
  }
}

async function safeCountByQuery(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<number> {
  const rows = await safeSelectMany<{ id?: string | null }>(db, table, query);
  return rows.length;
}

async function getRevenueToday(
  db: SupabaseRestClient,
  dayWindow: { startUtc: string; endUtc: string }
): Promise<number> {
  const query = new URLSearchParams();
  query.set("select", "amount,status,created_at");
  query.set("status", "in.(paid,captured)");
  query.set("and", `(created_at.gte.${dayWindow.startUtc},created_at.lte.${dayWindow.endUtc})`);

  const rows = await safeSelectMany<PaymentAmountRow>(db, "payments", query);
  return rows.reduce((sum, row) => {
    const amount = typeof row.amount === "string" ? Number(row.amount) : Number(row.amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

async function getActiveBookings(db: SupabaseRestClient): Promise<number> {
  const statusQuery = new URLSearchParams();
  statusQuery.set("select", "id");
  statusQuery.set("status", "in.(confirmed,traveling)");
  try {
    const statusRows = await db.selectMany<{ id?: string }>("bookings", statusQuery);
    return statusRows.length;
  } catch {
    // fall through to schema-compatible fallback for current booking model
  }

  const fallbackQuery = new URLSearchParams();
  fallbackQuery.set("select", "id");
  fallbackQuery.set("supplier_status", "in.(confirmed,partially_confirmed)");
  return safeCountByQuery(db, "bookings", fallbackQuery);
}

async function getPendingPayments(db: SupabaseRestClient): Promise<number> {
  const query = new URLSearchParams();
  query.set("select", "id");
  query.set("payment_status", "in.(pending,payment_pending)");
  return safeCountByQuery(db, "bookings", query);
}

async function getRefundLiability(db: SupabaseRestClient): Promise<number> {
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const statuses = "in.(initiated,pending,processing)";

  const query = new URLSearchParams();
  query.set("select", "amount,status,created_at");
  query.set("status", statuses);
  query.set("created_at", `gte.${sinceIso}`);

  try {
    const rows = await db.selectMany<PaymentAmountRow>("refunds", query);
    return rows.reduce((sum, row) => {
      const amount = typeof row.amount === "string" ? Number(row.amount) : Number(row.amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  } catch {
    // fallback to schema-native table
  }

  const fallbackQuery = new URLSearchParams();
  fallbackQuery.set("select", "amount,status,created_at");
  fallbackQuery.set("status", statuses);
  fallbackQuery.set("created_at", `gte.${sinceIso}`);

  const rows = await safeSelectMany<PaymentAmountRow>(db, "payment_refunds", fallbackQuery);
  return rows.reduce((sum, row) => {
    const amount = typeof row.amount === "string" ? Number(row.amount) : Number(row.amount ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

interface DocumentMetricRow {
  id?: string | null;
  public_url?: string | null;
  url?: string | null;
  status?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  created_at?: string | null;
}

function isRecentWithinDays(value: string | null | undefined, days: number): boolean {
  const iso = (value ?? "").trim();
  if (!iso) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function isMissingDocumentMetricRow(row: DocumentMetricRow): boolean {
  const url = (row.public_url ?? row.url ?? "").trim();
  const fileRef = (row.storage_path ?? row.file_path ?? "").trim();
  const status = (row.status ?? "").trim().toLowerCase();
  return !url || !fileRef || status === "pending" || status === "failed";
}

async function getMissingDocumentsCount(db: SupabaseRestClient): Promise<number> {
  const attempts: Array<{ table: string; select: string }> = [
    {
      table: "documents",
      select: "id,public_url,status,storage_path,created_at",
    },
    {
      table: "documents",
      select: "id,public_url,storage_path,created_at",
    },
    {
      table: "booking_documents",
      select: "id,url,status,file_path,created_at",
    },
    {
      table: "booking_documents",
      select: "id,file_url,status,file_path,created_at",
    },
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

async function getFailedAutomations24h(db: SupabaseRestClient): Promise<number> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const candidates: Array<{ table: string; query: URLSearchParams }> = [
    {
      table: "event_failures",
      query: new URLSearchParams({
        select: "id",
        status: "eq.failed",
        created_at: `gte.${sinceIso}`,
      }),
    },
    {
      table: "automation_failures",
      query: new URLSearchParams({
        select: "id",
        status: "eq.failed",
        created_at: `gte.${sinceIso}`,
      }),
    },
  ];

  for (const candidate of candidates) {
    const count = await safeCountByQuery(db, candidate.table, candidate.query);
    if (count > 0) return count;
  }
  return 0;
}

function formatCustomerName(customer?: CustomerRow): string | null {
  if (!customer) return null;
  const first = customer.first_name?.trim() ?? "";
  const last = customer.last_name?.trim() ?? "";
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || customer.email?.trim() || null;
}

async function getRecentBookings(db: SupabaseRestClient): Promise<ControlCenterRecentBooking[]> {
  const bookingQuery = new URLSearchParams();
  bookingQuery.set(
    "select",
    "id,booking_code,customer_id,lifecycle_status,payment_status,created_at"
  );
  bookingQuery.set("order", "created_at.desc");
  bookingQuery.set("limit", "5");

  const rows = await safeSelectMany<BookingRow>(db, "bookings", bookingQuery);
  if (rows.length === 0) return [];

  const customerIds = Array.from(
    new Set(rows.map((row) => row.customer_id).filter((value): value is string => Boolean(value)))
  );

  let customerMap = new Map<string, CustomerRow>();
  if (customerIds.length > 0) {
    const customerQuery = new URLSearchParams();
    customerQuery.set("select", "id,first_name,last_name,email");
    customerQuery.set("id", `in.(${customerIds.join(",")})`);
    const customers = await safeSelectMany<CustomerRow>(db, "customers", customerQuery);
    customerMap = new Map(
      customers
        .filter((c): c is CustomerRow & { id: string } => Boolean(c.id))
        .map((c) => [c.id, c])
    );
  }

  return rows.map((row) => ({
    booking_id: row.booking_code?.trim() || row.id?.trim() || "—",
    customer_name: formatCustomerName(customerMap.get(row.customer_id ?? "")),
    status: row.lifecycle_status?.trim() || row.payment_status?.trim() || null,
    created_at: row.created_at ?? null,
  }));
}

function buildFallbackAlerts(
  metrics: Pick<
    ControlCenterResponse,
    "pendingPayments" | "activeBookings" | "missingDocuments" | "openSupportRequests" | "failedAutomations24h"
  >
): ControlCenterAlert[] {
  const alerts: ControlCenterAlert[] = [];
  if (metrics.pendingPayments > 0) {
    alerts.push({
      severity: "warn",
      message: "Pending payments require attention",
    });
  }
  if (metrics.activeBookings > 50) {
    alerts.push({
      severity: "warn",
      message: "High active booking load",
    });
  }
  if (metrics.missingDocuments > 0) {
    alerts.push({
      severity: "warn",
      message: "Some booking documents are missing or pending",
    });
  }
  if (metrics.openSupportRequests > 0) {
    alerts.push({
      severity: "warn",
      message: "Open support requests need attention",
    });
  }
  if (metrics.failedAutomations24h > 0) {
    alerts.push({
      severity: "error",
      message: "Automation failures detected in the last 24 hours",
    });
  }
  return alerts;
}

async function getAlertsFromEventFailures(db: SupabaseRestClient): Promise<ControlCenterAlert[]> {
  const query = new URLSearchParams();
  query.set("select", "event,reason,error,message,created_at");
  query.set("order", "created_at.desc");
  query.set("limit", "5");

  const rows = await db.selectMany<EventFailureRow>("event_failures", query);
  return rows
    .map((row) => {
      const eventName = row.event?.trim() || "event";
      const reason =
        row.reason?.trim() || row.error?.trim() || row.message?.trim() || "Unknown failure";
      return {
        severity: "error" as const,
        message: `[${eventName}] failed: ${reason}`,
        created_at: row.created_at ?? undefined,
      };
    })
    .filter((row) => row.message.trim().length > 0);
}

async function getAlertsFromSystemLogs(db: SupabaseRestClient): Promise<ControlCenterAlert[]> {
  const query = new URLSearchParams();
  query.set("select", "level,message,created_at");
  query.set("level", "in.(error,warn)");
  query.set("order", "created_at.desc");
  query.set("limit", "5");

  const rows = await db.selectMany<SystemLogRow>("system_logs", query);
  return rows
    .map((row) => {
      const level = (row.level?.trim().toLowerCase() || "warn") as "warn" | "error";
      const normalizedLevel: ControlCenterAlertSeverity = level === "error" ? "error" : "warn";
      const message = row.message?.trim() || "System log alert";
      return {
        severity: normalizedLevel,
        message: `[${normalizedLevel}] ${message}`,
        created_at: row.created_at ?? undefined,
      };
    })
    .filter((row) => row.message.trim().length > 0);
}

async function getAlerts(
  db: SupabaseRestClient,
  metrics: Pick<
    ControlCenterResponse,
    "pendingPayments" | "activeBookings" | "missingDocuments" | "openSupportRequests" | "failedAutomations24h"
  >
): Promise<ControlCenterAlert[]> {
  const appendDerivedAlerts = (alerts: ControlCenterAlert[]) => {
    const next = [...alerts];
    if (
      metrics.missingDocuments > 0 &&
      !next.some((alert) => /documents?.*(missing|pending)|missing.*documents?/i.test(alert.message))
    ) {
      next.push({
        severity: "warn",
        message: "Some booking documents are missing or pending",
      });
    }
    if (
      metrics.openSupportRequests > 0 &&
      !next.some((alert) => /support requests?|open support/i.test(alert.message))
    ) {
      next.push({
        severity: "warn",
        message: "Open support requests need attention",
      });
    }
    if (
      metrics.failedAutomations24h > 0 &&
      !next.some((alert) => /automation.*fail|failed automations?|event failures?/i.test(alert.message))
    ) {
      next.push({
        severity: "error",
        message: "Automation failures detected in the last 24 hours",
      });
    }
    return next;
  };

  try {
    const eventAlerts = await getAlertsFromEventFailures(db);
    if (eventAlerts.length > 0) {
      return appendDerivedAlerts(eventAlerts);
    }
  } catch {
    // table may not exist
  }

  try {
    const logAlerts = await getAlertsFromSystemLogs(db);
    if (logAlerts.length > 0) {
      return appendDerivedAlerts(logAlerts);
    }
  } catch {
    // table may not exist
  }

  return buildFallbackAlerts(metrics);
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const dayWindow = getISTDayWindowUtc();
    const [
      revenueToday,
      activeBookings,
      pendingPayments,
      refundLiability,
      missingDocuments,
      openSupportRequests,
      failedAutomations24h,
      recentBookings,
    ] = await Promise.all([
      getRevenueToday(db, dayWindow),
      getActiveBookings(db),
      getPendingPayments(db),
      getRefundLiability(db),
      getMissingDocumentsCount(db),
      countOpenSupportRequestsLast30Days(),
      getFailedAutomations24h(db),
      getRecentBookings(db),
    ]);
    const alerts = await getAlerts(db, {
      pendingPayments,
      activeBookings,
      missingDocuments,
      openSupportRequests,
      failedAutomations24h,
    });

    const payload: ControlCenterResponse = {
      revenueToday,
      activeBookings,
      pendingPayments,
      refundLiability,
      missingDocuments,
      openSupportRequests,
      failedAutomations24h,
      recentBookings,
      alerts,
    };

    if (process.env.NODE_ENV !== "production") {
      payload.dayWindow = dayWindow;
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      const payload: ControlCenterResponse = { ...EMPTY_RESPONSE };
      if (process.env.NODE_ENV !== "production") {
        payload.dayWindow = getISTDayWindowUtc();
      }
      return NextResponse.json(payload);
    }

    return routeError(500, "Failed to load control center metrics");
  }
}
