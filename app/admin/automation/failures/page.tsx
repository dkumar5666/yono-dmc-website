"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";

interface AutomationFailureRow {
  id?: string | null;
  booking_id?: string | null;
  event?: string | null;
  status?: string | null;
  attempts?: number | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AutomationFailuresListResponse {
  rows?: AutomationFailureRow[];
  total?: number;
  error?: string;
}

const PAGE_LIMIT = 25;

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

function statusClass(status?: string | null): string {
  const value = safeString(status).toLowerCase();
  if (["failed", "error"].some((t) => value.includes(t))) return "border-rose-200 bg-rose-50 text-rose-700";
  if (["retry", "pending", "processing"].some((t) => value.includes(t))) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["resolved", "success", "succeeded"].some((t) => value.includes(t))) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((__, col) => (
            <div key={col} className="h-10 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminAutomationFailuresPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const appliedStatus = searchParams.get("status") ?? "all";
  const appliedBookingId = searchParams.get("booking_id") ?? "";
  const appliedEvent = searchParams.get("event") ?? "";
  const appliedQ = searchParams.get("q") ?? "";
  const appliedSinceHours = searchParams.get("since_hours") ?? "72";
  const appliedOffset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const [status, setStatus] = useState(appliedStatus);
  const [bookingId, setBookingId] = useState(appliedBookingId);
  const [event, setEvent] = useState(appliedEvent);
  const [q, setQ] = useState(appliedQ);
  const [sinceHours, setSinceHours] = useState(appliedSinceHours);
  const [rows, setRows] = useState<AutomationFailureRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = searchParams.toString();

  useEffect(() => {
    setStatus(appliedStatus);
    setBookingId(appliedBookingId);
    setEvent(appliedEvent);
    setQ(appliedQ);
    setSinceHours(appliedSinceHours);
  }, [appliedStatus, appliedBookingId, appliedEvent, appliedQ, appliedSinceHours]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = new URL("/api/admin/automation/failures", window.location.origin);
      searchParams.forEach((value, key) => endpoint.searchParams.set(key, value));
      if (!endpoint.searchParams.get("limit")) endpoint.searchParams.set("limit", String(PAGE_LIMIT));
      if (!endpoint.searchParams.get("since_hours")) endpoint.searchParams.set("since_hours", "72");

      const response = await fetch(endpoint.toString(), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as AutomationFailuresListResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to fetch automation failures (${response.status})`);
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch automation failures");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadRows();
  }, [queryKey, loadRows]);

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());

    if (status && status !== "all") params.set("status", status);
    else params.delete("status");

    if (bookingId.trim()) params.set("booking_id", bookingId.trim());
    else params.delete("booking_id");

    if (event.trim()) params.set("event", event.trim());
    else params.delete("event");

    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");

    if (sinceHours.trim()) params.set("since_hours", sinceHours.trim());
    else params.set("since_hours", "72");

    params.set("limit", String(PAGE_LIMIT));
    params.set("offset", "0");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setStatus("all");
    setBookingId("");
    setEvent("");
    setQ("");
    setSinceHours("72");
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_LIMIT));
    params.set("since_hours", "72");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function goToOffset(nextOffset: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", String(PAGE_LIMIT));
    params.set("offset", String(Math.max(0, nextOffset)));
    router.replace(`${pathname}?${params.toString()}`);
  }

  const pageStart = total === 0 ? 0 : appliedOffset + 1;
  const pageEnd = Math.min(total, appliedOffset + rows.length);
  const canPrev = appliedOffset > 0;
  const canNext = appliedOffset + PAGE_LIMIT < total;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Automation Failures</h2>
        <p className="text-sm text-slate-500">Read-only queue of automation errors and retry states.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            >
              <option value="all">All</option>
              <option value="failed">Failed</option>
              <option value="retrying">Retrying</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Booking ID
            </label>
            <input
              type="text"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="BK-..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Event
            </label>
            <input
              type="text"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="payment.confirmed"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search in error / message / event"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Since
            </label>
            <select
              value={sinceHours}
              onChange={(e) => setSinceHours(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            >
              <option value="24">24h</option>
              <option value="72">72h</option>
              <option value="168">7d</option>
            </select>
          </div>

          <div className="flex items-end gap-2 lg:col-span-2">
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-rose-800">Failed to fetch automation failures</p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadRows()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Failure Queue</h3>
            <p className="text-xs text-slate-500">
              Showing {pageStart}-{pageEnd} of {total}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToOffset(appliedOffset - PAGE_LIMIT)}
              disabled={!canPrev}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => goToOffset(appliedOffset + PAGE_LIMIT)}
              disabled={!canNext}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No automation failures found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Time</th>
                  <th className="px-3 py-3 font-semibold">Booking ID</th>
                  <th className="px-3 py-3 font-semibold">Event</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Attempts</th>
                  <th className="px-3 py-3 font-semibold">Last Error</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowId = safeString(row.id);
                  const rowBookingId = safeString(row.booking_id);
                  return (
                    <tr key={`${rowId || "automation-failure"}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {rowBookingId ? (
                          <Link
                            href={`/admin/bookings/${encodeURIComponent(rowBookingId)}`}
                            className="font-medium text-[#199ce0] hover:underline"
                          >
                            {rowBookingId}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">{safeString(row.event) || "-"}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClass(row.status)}`}>
                          {(safeString(row.status) || "-").replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{row.attempts ?? "-"}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="max-w-[320px] truncate" title={safeString(row.last_error) || undefined}>
                          {safeString(row.last_error) || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {rowId ? (
                          <Link
                            href={`/admin/automation/failures/${encodeURIComponent(rowId)}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400">
                            -
                          </span>
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
    </div>
  );
}

