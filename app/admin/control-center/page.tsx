"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CreditCard,
  IndianRupee,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";

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
  recentBookings: ControlCenterRecentBooking[];
  alerts: string[];
}

const EMPTY_PAYLOAD: ControlCenterPayload = {
  revenueToday: 0,
  activeBookings: 0,
  pendingPayments: 0,
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
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
}

export default function AdminControlCenterPage() {
  const [data, setData] = useState<ControlCenterPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadMetrics({ silent = false }: { silent?: boolean } = {}) {
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

      setData({
        revenueToday: Number(resolved?.revenueToday ?? 0),
        activeBookings: Number(resolved?.activeBookings ?? 0),
        pendingPayments: Number(resolved?.pendingPayments ?? 0),
        recentBookings: Array.isArray(resolved?.recentBookings) ? resolved.recentBookings : [],
        alerts: Array.isArray(resolved?.alerts)
          ? resolved.alerts.filter((item): item is string => typeof item === "string")
          : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load control center");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadMetrics();
  }, []);

  const hasAlerts = data.alerts.length > 0;
  const sortedRecent = useMemo(() => data.recentBookings ?? [], [data.recentBookings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Control Center</h2>
          <p className="text-sm text-slate-500">
            Live operational overview powered by Supabase booking data.
          </p>
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <>
              <KPISkeletonCard />
              <KPISkeletonCard />
              <KPISkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                label="Revenue Today"
                value={formatCurrency(data.revenueToday)}
                note="Paid/captured payments created today"
                icon={IndianRupee}
                accent="border-[#f5991c]/20 bg-[#f5991c]/10 text-[#f5991c]"
              />
              <MetricCard
                label="Active Bookings"
                value={String(data.activeBookings)}
                note="Confirmed / traveling workload"
                icon={Wallet}
                accent="border-[#199ce0]/20 bg-[#199ce0]/10 text-[#199ce0]"
              />
              <MetricCard
                label="Pending Payments"
                value={String(data.pendingPayments)}
                note="Bookings pending payment follow-up"
                icon={CreditCard}
                accent="border-amber-200 bg-amber-50 text-amber-600"
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
            <p className="text-xs text-slate-500">Auto-generated operational alerts from current metrics</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : hasAlerts ? (
          <ul className="space-y-2">
            {data.alerts.map((alert, index) => (
              <li
                key={`${alert}-${index}`}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                {alert}
              </li>
            ))}
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
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {booking.booking_id?.trim() || "—"}
                    </td>
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
    </div>
  );
}

