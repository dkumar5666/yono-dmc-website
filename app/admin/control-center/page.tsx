"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CreditCard,
  FileText,
  IndianRupee,
  Info,
  Loader2,
  LifeBuoy,
  RefreshCw,
  RotateCcw,
  Wallet,
} from "lucide-react";

type AlertSeverity = "warn" | "error" | "info";

interface ControlCenterAlert {
  severity?: AlertSeverity | null;
  message?: string | null;
  created_at?: string | null;
}

interface ControlCenterRecentBooking {
  booking_id?: string | null;
  customer_name?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface ControlCenterPayload {
  revenueToday: number;
  activeBookings: number;
  pendingPayments: number;
  refundLiability: number;
  missingDocuments: number;
  openSupportRequests: number;
  failedAutomations24h: number;
  retryingAutomations: number;
  recentBookings: ControlCenterRecentBooking[];
  alerts: ControlCenterAlert[];
  dayWindow?: {
    tz: string;
    startUtc: string;
    endUtc: string;
  };
}

const EMPTY_PAYLOAD: ControlCenterPayload = {
  revenueToday: 0,
  activeBookings: 0,
  pendingPayments: 0,
  refundLiability: 0,
  missingDocuments: 0,
  openSupportRequests: 0,
  failedAutomations24h: 0,
  retryingAutomations: 0,
  recentBookings: [],
  alerts: [],
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function KPISkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 h-4 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-3 w-40 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((__, j) => (
            <div key={j} className="h-10 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  href?: string;
}) {
  const content = (
    <div
      className={[
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition",
        href ? "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{note}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#199ce0]/40 rounded-2xl">
      {content}
    </Link>
  );
}

function alertStyles(severity: AlertSeverity | undefined | null) {
  switch (severity) {
    case "error":
      return {
        row: "border-rose-200 bg-rose-50 text-rose-800",
        badge: "border-rose-200 bg-white text-rose-700",
        label: "Error",
      };
    case "info":
      return {
        row: "border-sky-200 bg-sky-50 text-sky-800",
        badge: "border-sky-200 bg-white text-sky-700",
        label: "Info",
      };
    default:
      return {
        row: "border-amber-200 bg-amber-50 text-amber-800",
        badge: "border-amber-200 bg-white text-amber-700",
        label: "Warn",
      };
  }
}

export default function AdminControlCenterPage() {
  const [data, setData] = useState<ControlCenterPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  async function loadMetrics({ silent = false }: { silent?: boolean } = {}) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const response = await fetch("/api/admin/control-center", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | (ControlCenterPayload & { data?: ControlCenterPayload })
        | { error?: string; success?: boolean }
        | null;

      if (!response.ok) {
        const message =
          (payload as { error?: string } | null)?.error ??
          `Failed to load control center (${response.status})`;
        throw new Error(message);
      }

      const resolved = (payload as { data?: ControlCenterPayload } | null)?.data
        ? (payload as { data: ControlCenterPayload }).data
        : (payload as ControlCenterPayload | null);

      const normalizedAlerts: ControlCenterAlert[] = Array.isArray(resolved?.alerts)
        ? resolved.alerts.reduce<ControlCenterAlert[]>((acc, item) => {
            if (!item || typeof item !== "object") return acc;
            acc.push({
              severity:
                item.severity === "error" || item.severity === "info" || item.severity === "warn"
                  ? item.severity
                  : "warn",
              message: typeof item.message === "string" ? item.message : "System alert",
              created_at: typeof item.created_at === "string" ? item.created_at : null,
            });
            return acc;
          }, [])
        : [];

      setData({
        revenueToday: Number(resolved?.revenueToday ?? 0),
        activeBookings: Number(resolved?.activeBookings ?? 0),
        pendingPayments: Number(resolved?.pendingPayments ?? 0),
        refundLiability: Number(resolved?.refundLiability ?? 0),
        missingDocuments: Number(resolved?.missingDocuments ?? 0),
        openSupportRequests: Number(resolved?.openSupportRequests ?? 0),
        failedAutomations24h: Number(resolved?.failedAutomations24h ?? 0),
        retryingAutomations: Number(resolved?.retryingAutomations ?? 0),
        recentBookings: Array.isArray(resolved?.recentBookings) ? resolved.recentBookings : [],
        alerts: normalizedAlerts,
        dayWindow: resolved?.dayWindow,
      });

      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load control center");
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    void loadMetrics();

    const intervalId = window.setInterval(() => {
      void loadMetrics({ silent: true });
    }, 25_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const hasAlerts = data.alerts.length > 0;
  const sortedRecent = useMemo(() => data.recentBookings ?? [], [data.recentBookings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Control Center</h2>
          <p className="text-sm text-slate-500">Live operational overview powered by Supabase booking data.</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Last updated: {formatTime(lastUpdatedAt)}</span>
            {refreshing ? (
              <span className="inline-flex items-center gap-1.5 text-[#199ce0]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating...
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadMetrics({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-rose-800">Failed to load Control Center</p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadMetrics()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">KPI Snapshot</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {loading ? (
            <>
              <KPISkeletonCard />
              <KPISkeletonCard />
              <KPISkeletonCard />
              <KPISkeletonCard />
              <KPISkeletonCard />
              <KPISkeletonCard />
              <KPISkeletonCard />
              <KPISkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                label="Revenue Today"
                value={formatCurrency(data.revenueToday)}
                note="Paid/captured payments created today (IST)"
                icon={IndianRupee}
                accent="border-[#f5991c]/20 bg-[#f5991c]/10 text-[#f5991c]"
                href="/admin/payments?day=today&status=paid"
              />
              <MetricCard
                label="Active Bookings"
                value={String(data.activeBookings)}
                note="Confirmed / traveling workload"
                icon={Wallet}
                accent="border-[#199ce0]/20 bg-[#199ce0]/10 text-[#199ce0]"
                href="/admin/bookings?status=confirmed"
              />
              <MetricCard
                label="Pending Payments"
                value={String(data.pendingPayments)}
                note="Bookings pending payment follow-up"
                icon={CreditCard}
                accent="border-amber-200 bg-amber-50 text-amber-600"
                href="/admin/bookings?payment_status=pending"
              />
              <MetricCard
                label="Refund Liability"
                value={formatCurrency(data.refundLiability)}
                note="Pending refunds (last 30 days)"
                icon={RotateCcw}
                accent="border-rose-200 bg-rose-50 text-rose-600"
                href="/admin/refunds?status=pending"
              />
              <MetricCard
                label="Missing Documents"
                value={String(data.missingDocuments)}
                note="Docs needing attention"
                icon={FileText}
                accent="border-orange-200 bg-orange-50 text-orange-600"
                href="/admin/documents?missing_only=1"
              />
              <MetricCard
                label="Open Support"
                value={String(data.openSupportRequests)}
                note="Open requests (last 30 days)"
                icon={LifeBuoy}
                accent="border-violet-200 bg-violet-50 text-violet-600"
                href="/admin/support-requests?status=open"
              />
              <MetricCard
                label="Failed Automations"
                value={String(data.failedAutomations24h)}
                note="Failures in last 24 hours"
                icon={AlertTriangle}
                accent="border-rose-200 bg-rose-50 text-rose-600"
                href="/admin/automation/failures?status=failed&since_hours=24"
              />
              <MetricCard
                label="Retries In Progress"
                value={String(data.retryingAutomations)}
                note="Automation retries currently running"
                icon={RefreshCw}
                accent="border-sky-200 bg-sky-50 text-sky-600"
                href="/admin/automation/failures?status=retrying"
              />
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Alerts</h3>
            <p className="text-xs text-slate-500">System alerts from event failures / logs with fallback rules</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : hasAlerts ? (
          <ul className="space-y-2">
            {data.alerts.map((alert, index) => {
              const styles = alertStyles(alert.severity);
              const alertMessage = alert.message?.trim() || "System alert";
              const alertHref = /pending payments/i.test(alertMessage)
                ? "/admin/bookings?payment_status=pending"
                : /documents?.*(missing|pending)|missing.*documents?/i.test(alertMessage)
                  ? "/admin/documents?missing_only=1"
                  : /support requests?|open support/i.test(alertMessage)
                    ? "/admin/support-requests?status=open"
                  : /automation.*fail|failed automations?|event failures?/i.test(alertMessage)
                    ? "/admin/automation/failures?status=failed&since_hours=24"
                  : "/admin/bookings";
              return (
                <li
                  key={`${alertMessage}-${index}`}
                  className={`rounded-xl border px-3 py-2 text-sm ${styles.row}`}
                >
                  <Link
                    href={alertHref}
                    className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#199ce0]/40"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${styles.badge}`}>
                          {styles.label}
                        </span>
                        <span>{alertMessage}</span>
                      </div>
                      {alert.created_at ? (
                        <span className="text-xs opacity-80">{formatDateTime(alert.created_at)}</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            No active alerts. System metrics look normal.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Recent Bookings</h3>
          <p className="text-xs text-slate-500">Latest bookings from the lifecycle system</p>
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : sortedRecent.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No recent bookings found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Booking ID</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecent.map((booking, index) => (
                  <tr key={`${booking.booking_id ?? "booking"}-${index}`} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{booking.booking_id?.trim() || "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{booking.customer_name?.trim() || "—"}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                        {(booking.status?.replaceAll("_", " ") || "unknown").trim()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(booking.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {process.env.NODE_ENV !== "production" && data.dayWindow ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
            <Info className="h-4 w-4 text-slate-500" />
            Dev Debug — Day Window
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(data.dayWindow, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
