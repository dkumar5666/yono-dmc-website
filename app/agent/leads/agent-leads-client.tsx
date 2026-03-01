"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";

type LeadStage = "new" | "qualified" | "quote_sent" | "negotiation" | "won" | "lost";

interface AgentLeadRow {
  id?: string | null;
  lead_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  destination?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  budget?: number | null;
  stage?: LeadStage | null;
  source?: string | null;
  updated_at?: string | null;
}

interface AgentLeadsResponse {
  rows?: AgentLeadRow[];
  total?: number;
  error?: string;
}

const STAGES: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function stageBadgeClass(stage: string): string {
  const normalized = safeString(stage).toLowerCase();
  if (normalized === "new") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "qualified") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (normalized === "quote_sent") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "negotiation") return "border-violet-200 bg-violet-50 text-violet-700";
  if (normalized === "won") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "lost") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AgentLeadsClient() {
  const [rows, setRows] = useState<AgentLeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState("all");
  const [destination, setDestination] = useState("");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const [applied, setApplied] = useState({
    stage: "all",
    destination: "",
    q: "",
    fromDate: "",
    toDate: "",
  });

  const loadRows = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(page * limit),
        });
        if (applied.stage && applied.stage !== "all") params.set("stage", applied.stage);
        if (applied.destination) params.set("destination", applied.destination);
        if (applied.q) params.set("q", applied.q);
        if (applied.fromDate) params.set("from", applied.fromDate);
        if (applied.toDate) params.set("to", applied.toDate);

        const response = await fetch(`/api/agent/leads?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as AgentLeadsResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load leads (${response.status})`);
        }

        setRows(Array.isArray(payload.rows) ? payload.rows : []);
        setTotal(Number(payload.total ?? 0));
      } catch (err) {
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load leads");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applied, page]
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  function applyFilters() {
    setApplied({
      stage,
      destination: destination.trim(),
      q: q.trim(),
      fromDate,
      toDate,
    });
    setPage(0);
  }

  function clearFilters() {
    setStage("all");
    setDestination("");
    setQ("");
    setFromDate("");
    setToDate("");
    setApplied({
      stage: "all",
      destination: "",
      q: "",
      fromDate: "",
      toDate: "",
    });
    setPage(0);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">My Leads</h1>
            <p className="mt-1 text-sm text-slate-500">Lead requests created by your agency account.</p>
          </div>
          <Link
            href="/agent/leads/new"
            className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#148bc7]"
          >
            Request a Quote
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Stage</span>
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {STAGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Destination</span>
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Dubai / Bali"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm xl:col-span-2">
            <span className="text-slate-600">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Name / phone / email / booking"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#148bc7]"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void loadRows({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Failed to load leads</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No leads found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Lead</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Destination</th>
                  <th className="px-3 py-3 font-semibold">Travel</th>
                  <th className="px-3 py-3 font-semibold">Budget</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Updated</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const leadRef = safeString(row.lead_id) || safeString(row.id);
                  return (
                    <tr key={`${leadRef || "lead"}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{leadRef || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">
                        <p>{safeString(row.customer_name) || "-"}</p>
                        <p className="text-xs text-slate-500">
                          {safeString(row.customer_phone) || safeString(row.customer_email) || "-"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{safeString(row.destination) || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {formatDate(row.travel_start_date)} - {formatDate(row.travel_end_date)}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatAmount(row.budget)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${stageBadgeClass(row.stage || "")}`}>
                          {safeString(row.stage).replaceAll("_", " ") || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDate(row.updated_at)}</td>
                      <td className="px-3 py-3 text-right">
                        {leadRef ? (
                          <Link
                            href={`/agent/leads/${encodeURIComponent(leadRef)}`}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
                          >
                            Open
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-600">
          Showing <span className="font-medium text-slate-900">{rows.length}</span> of{" "}
          <span className="font-medium text-slate-900">{total}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={!canPrev || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={!canNext || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
