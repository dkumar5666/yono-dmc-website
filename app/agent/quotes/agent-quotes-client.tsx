"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Search } from "lucide-react";

interface QuoteRow {
  id?: string | null;
  quotation_id?: string | null;
  quotation_code?: string | null;
  lead_id?: string | null;
  booking_id?: string | null;
  status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  pdf_url?: string | null;
  summary_url?: string | null;
}

interface QuotesResponse {
  rows?: QuoteRow[];
  total?: number;
  error?: string;
}

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

function formatAmount(amount?: number | null, currency = "INR"): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusBadgeClass(status: string): string {
  const normalized = safeString(status).toLowerCase();
  if (normalized === "sent" || normalized === "quote_sent") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (normalized === "accepted" || normalized === "won") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "draft") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  if (normalized === "rejected" || normalized === "lost") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

export default function AgentQuotesClient() {
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const limit = 25;

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
        if (status !== "all") params.set("status", status);
        if (q.trim()) params.set("q", q.trim());

        const response = await fetch(`/api/agent/quotes?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as QuotesResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load quotes (${response.status})`);
        }

        setRows(Array.isArray(payload?.rows) ? payload!.rows : []);
        setTotal(Number(payload?.total ?? 0));
      } catch (err) {
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load quotations");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, q, status]
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Quotations</h1>
        <p className="mt-1 text-sm text-slate-500">View quote responses prepared for your leads.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-slate-600">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(0);
                }}
                placeholder="Quote ID / lead / booking"
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadRows({ silent: true })}
              disabled={loading || refreshing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Failed to load quotations</p>
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
            No quotations available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Quote</th>
                  <th className="px-3 py-3 font-semibold">Lead</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Dates</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const quoteRef = safeString(row.quotation_code) || safeString(row.quotation_id) || safeString(row.id);
                  const leadRef = safeString(row.lead_id);
                  return (
                    <tr key={`${quoteRef || "quote"}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{quoteRef || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {leadRef ? (
                          <Link href={`/agent/leads/${encodeURIComponent(leadRef)}`} className="text-[#199ce0] hover:underline">
                            {leadRef}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status || "")}`}>
                          {safeString(row.status) || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatAmount(row.total_amount ?? null, safeString(row.currency) || "INR")}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <p>Created {formatDate(row.created_at)}</p>
                        <p className="text-xs">Expires {formatDate(row.expires_at)}</p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {safeString(row.pdf_url) ? (
                            <a
                              href={safeString(row.pdf_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                            >
                              PDF
                            </a>
                          ) : null}
                          {safeString(row.summary_url) ? (
                            <a
                              href={safeString(row.summary_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                            >
                              Summary
                            </a>
                          ) : null}
                        </div>
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

