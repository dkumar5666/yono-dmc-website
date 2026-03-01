"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

type OutreachType = "quote_followup" | "payment_reminder" | "reengagement";

interface OutreachPreviewItem {
  lead_id: string;
  lead_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  destination?: string | null;
  type: OutreachType;
  step: string;
  template: string;
  due_at: string;
  booking_id?: string | null;
}

interface OutreachLogItem {
  id: string;
  lead_id?: string | null;
  event: string;
  status: string;
  message: string;
  created_at?: string | null;
}

interface OutreachFailureItem {
  id: string;
  lead_id?: string | null;
  booking_id?: string | null;
  event: string;
  status?: string | null;
  attempts?: number;
  last_error?: string | null;
  created_at?: string | null;
}

interface OutreachResponse {
  upcoming: OutreachPreviewItem[];
  recent: OutreachLogItem[];
  failures: OutreachFailureItem[];
  summary: {
    scheduled: number;
    sent_last_24h: number;
    failures_open: number;
  };
}

const EMPTY: OutreachResponse = {
  upcoming: [],
  recent: [],
  failures: [],
  summary: { scheduled: 0, sent_last_24h: 0, failures_open: 0 },
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string): string {
  const value = safeString(status).toLowerCase();
  if (value === "success" || value === "sent" || value === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "failed" || value === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "skipped" || value === "info") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function AdminCrmOutreachPage() {
  const [data, setData] = useState<OutreachResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/crm/outreach", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Partial<OutreachResponse> & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load outreach dashboard (${response.status})`);
      }
      setData({
        upcoming: Array.isArray(payload.upcoming) ? payload.upcoming : [],
        recent: Array.isArray(payload.recent) ? payload.recent : [],
        failures: Array.isArray(payload.failures) ? payload.failures : [],
        summary: payload.summary ?? EMPTY.summary,
      });
    } catch (err) {
      setData(EMPTY);
      setError(err instanceof Error ? err.message : "Failed to load outreach dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">CRM Outreach</h2>
          <p className="mt-1 text-sm text-slate-500">Scheduled follow-ups, recent sends, and outreach failures.</p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Scheduled</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.scheduled}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Sent (24h)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.sent_last_24h}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Failures</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.failures_open}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Upcoming Scheduled Messages</h3>
        <p className="mt-1 text-xs text-slate-500">Computed schedule based on quote, payment, and inactivity rules.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3 font-semibold">Lead</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Step</th>
                <th className="px-3 py-3 font-semibold">Due</th>
                <th className="px-3 py-3 font-semibold">Booking</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">Loading schedule...</td>
                </tr>
              ) : data.upcoming.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">No upcoming outreach scheduled.</td>
                </tr>
              ) : (
                data.upcoming.map((row) => (
                  <tr key={`${row.lead_id}-${row.step}-${row.due_at}`} className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      <Link href={`/admin/crm/leads/${encodeURIComponent(row.lead_id)}`} className="text-[#199ce0] hover:underline">
                        {safeString(row.lead_code) || row.lead_id}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{safeString(row.customer_name) || safeString(row.customer_phone) || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{safeString(row.type).replaceAll("_", " ")}</td>
                    <td className="px-3 py-3 text-slate-700">{safeString(row.step)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatDateTime(row.due_at)}</td>
                    <td className="px-3 py-3 text-slate-700">{safeString(row.booking_id) || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Recent Sends</h3>
          <p className="mt-1 text-xs text-slate-500">Latest outreach delivery attempts.</p>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-sm text-slate-500">Loading recent sends...</p>
            ) : data.recent.length === 0 ? (
              <p className="text-sm text-slate-500">No outreach activity yet.</p>
            ) : (
              data.recent.slice(0, 20).map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{safeString(row.event).replaceAll("_", " ")}</p>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(row.status)}`}>
                      {safeString(row.status) || "info"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{safeString(row.message) || "No details"}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Failures</h3>
          <p className="mt-1 text-xs text-slate-500">Open outreach automation failures.</p>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="text-sm text-slate-500">Loading failures...</p>
            ) : data.failures.length === 0 ? (
              <p className="text-sm text-slate-500">No outreach failures.</p>
            ) : (
              data.failures.slice(0, 20).map((row) => (
                <div key={row.id} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-rose-900">{safeString(row.event)}</p>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(safeString(row.status) || "failed")}`}>
                      {safeString(row.status) || "failed"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-rose-800">{safeString(row.last_error) || "No error details"}</p>
                  <p className="mt-1 text-xs text-rose-700">{formatDateTime(row.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

