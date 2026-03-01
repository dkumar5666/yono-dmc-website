"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  IndianRupee,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

type Severity = "info" | "warn" | "error";
type Priority = "low" | "medium" | "high";

interface DashboardPayload {
  kpis: {
    revenueToday: number;
    revenueMonth: number;
    conversionRate30d: number;
    avgBookingValue: number;
    pendingRevenue: number;
    leadsToday: number;
    quotesSentToday: number;
    paymentsPending: number;
  };
  funnel: {
    windowDays: number;
    counts: { new: number; qualified: number; quote_sent: number; negotiation: number; won: number };
    conversions: {
      newToQualified: number;
      qualifiedToQuoteSent: number;
      quoteSentToNegotiation: number;
      negotiationToWon: number;
      overall: number;
    };
  };
  alerts: Array<{ key: string; severity: Severity; message: string; count: number; href: string }>;
  dailyTasks: Array<{ key: string; title: string; detail: string; href: string; priority: Priority }>;
  trends: {
    leads7d: Array<{ date: string; label: string; value: number }>;
    revenue7d: Array<{ date: string; label: string; value: number }>;
  };
  performance: {
    avgLeadResponseHours: number | null;
    avgQuoteTurnaroundHours: number | null;
    avgPaymentCompletionHours: number | null;
  };
  meta: {
    generatedAt: string;
    timezone: "Asia/Kolkata";
  };
}

const EMPTY: DashboardPayload = {
  kpis: {
    revenueToday: 0,
    revenueMonth: 0,
    conversionRate30d: 0,
    avgBookingValue: 0,
    pendingRevenue: 0,
    leadsToday: 0,
    quotesSentToday: 0,
    paymentsPending: 0,
  },
  funnel: {
    windowDays: 30,
    counts: { new: 0, qualified: 0, quote_sent: 0, negotiation: 0, won: 0 },
    conversions: {
      newToQualified: 0,
      qualifiedToQuoteSent: 0,
      quoteSentToNegotiation: 0,
      negotiationToWon: 0,
      overall: 0,
    },
  },
  alerts: [],
  dailyTasks: [],
  trends: { leads7d: [], revenue7d: [] },
  performance: {
    avgLeadResponseHours: null,
    avgQuoteTurnaroundHours: null,
    avgPaymentCompletionHours: null,
  },
  meta: {
    generatedAt: "",
    timezone: "Asia/Kolkata",
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)} hrs`;
}

function severityStyles(severity: Severity) {
  if (severity === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function priorityStyles(priority: Priority) {
  if (priority === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function KpiCard({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </Link>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-9 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

export default function AdminBusinessDashboardPage() {
  const [data, setData] = useState<DashboardPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function load({ silent = false }: { silent?: boolean } = {}) {
    if (inFlight.current) return;
    inFlight.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/business/dashboard", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as DashboardPayload | { error?: string } | null;
      if (!response.ok) {
        const message = (payload as { error?: string } | null)?.error ?? `Failed to load dashboard (${response.status})`;
        throw new Error(message);
      }
      setData((payload as DashboardPayload) ?? EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load business dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load({ silent: true }), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  const maxLeadTrend = useMemo(
    () => Math.max(1, ...data.trends.leads7d.map((row) => row.value)),
    [data.trends.leads7d]
  );
  const maxRevenueTrend = useMemo(
    () => Math.max(1, ...data.trends.revenue7d.map((row) => row.value)),
    [data.trends.revenue7d]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Business Dashboard</h2>
          <p className="text-sm text-slate-500">
            Revenue and sales intelligence for daily Yono DMC operations.
          </p>
          <p className="mt-1 text-xs text-slate-500">Updated: {data.meta.generatedAt || "-"}</p>
        </div>
        <button
          type="button"
          onClick={() => void load({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            Failed to load business dashboard
          </div>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <IndianRupee className="h-4 w-4 text-[#199ce0]" />
          KPI Snapshot
        </div>
        {loading ? (
          <SectionSkeleton />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Revenue Today" value={formatCurrency(data.kpis.revenueToday)} note="Paid/captured today (IST)" href="/admin/payments?day=today&status=paid" />
            <KpiCard label="Revenue This Month" value={formatCurrency(data.kpis.revenueMonth)} note="Paid/captured this month" href="/admin/payments?status=paid" />
            <KpiCard label="Conversion Rate (30d)" value={formatPercent(data.kpis.conversionRate30d)} note="Won leads / total leads" href="/admin/crm/leads?stage=won" />
            <KpiCard label="Avg Booking Value" value={formatCurrency(data.kpis.avgBookingValue)} note="Average booking amount" href="/admin/bookings" />
            <KpiCard label="Pending Revenue" value={formatCurrency(data.kpis.pendingRevenue)} note="Bookings not fully paid" href="/admin/bookings?payment_status=pending" />
            <KpiCard label="Leads Today" value={formatNumber(data.kpis.leadsToday)} note="Created today (IST)" href="/admin/crm/leads?stage=new" />
            <KpiCard label="Quotes Sent Today" value={formatNumber(data.kpis.quotesSentToday)} note="Quote activity today" href="/admin/crm/leads?stage=quote_sent" />
            <KpiCard label="Payments Pending" value={formatNumber(data.kpis.paymentsPending)} note="Pending payment records" href="/admin/payments?status=pending" />
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BarChart3 className="h-4 w-4 text-[#199ce0]" />
            Sales Funnel ({data.funnel.windowDays}d)
          </div>
          <div className="space-y-3">
            {[
              { label: "New Leads", value: data.funnel.counts.new, pct: 100 },
              { label: "Qualified", value: data.funnel.counts.qualified, pct: data.funnel.conversions.newToQualified },
              { label: "Quote Sent", value: data.funnel.counts.quote_sent, pct: data.funnel.conversions.qualifiedToQuoteSent },
              { label: "Negotiation", value: data.funnel.counts.negotiation, pct: data.funnel.conversions.quoteSentToNegotiation },
              { label: "Won", value: data.funnel.counts.won, pct: data.funnel.conversions.negotiationToWon },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="text-slate-500">{formatNumber(row.value)} | {formatPercent(row.pct)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#199ce0] to-[#1fb17e]" style={{ width: `${Math.max(4, Math.min(100, row.pct))}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Overall conversion: {formatPercent(data.funnel.conversions.overall)}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Operations Alerts
          </div>
          {data.alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">No active operations alerts.</div>
          ) : (
            <ul className="space-y-2">
              {data.alerts.map((alert) => (
                <li key={alert.key}>
                  <Link href={alert.href} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${severityStyles(alert.severity)}`}>
                    <span>{alert.message}</span>
                    <span className="font-semibold">{formatNumber(alert.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckSquare className="h-4 w-4 text-[#199ce0]" />
            Daily Staff Tasks
          </div>
          <ul className="space-y-2">
            {data.dailyTasks.map((task) => (
              <li key={task.key}>
                <Link href={task.href} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-white">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-500">{task.detail}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityStyles(task.priority)}`}>
                    {task.priority}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <TrendingUp className="h-4 w-4 text-[#199ce0]" />
            Performance Metrics
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Lead Response Time</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatHours(data.performance.avgLeadResponseHours)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Quote Turnaround</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatHours(data.performance.avgQuoteTurnaroundHours)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Payment Completion</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatHours(data.performance.avgPaymentCompletionHours)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Wallet className="h-4 w-4 text-[#199ce0]" />
            Leads Trend (7d)
          </div>
          <div className="space-y-2">
            {data.trends.leads7d.map((row) => (
              <div key={`leads-${row.date}`} className="grid grid-cols-[70px_1fr_60px] items-center gap-2 text-xs">
                <span className="text-slate-500">{row.label}</span>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#199ce0]" style={{ width: `${Math.max(4, (row.value / maxLeadTrend) * 100)}%` }} />
                </div>
                <span className="text-right font-medium text-slate-700">{formatNumber(row.value)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <IndianRupee className="h-4 w-4 text-[#1fb17e]" />
            Revenue Trend (7d)
          </div>
          <div className="space-y-2">
            {data.trends.revenue7d.map((row) => (
              <div key={`rev-${row.date}`} className="grid grid-cols-[70px_1fr_90px] items-center gap-2 text-xs">
                <span className="text-slate-500">{row.label}</span>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#1fb17e]" style={{ width: `${Math.max(4, (row.value / maxRevenueTrend) * 100)}%` }} />
                </div>
                <span className="text-right font-medium text-slate-700">{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
