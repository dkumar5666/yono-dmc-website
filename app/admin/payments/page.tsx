"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";

interface PaymentListRow {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
}

interface PaymentListResponse {
  rows?: PaymentListRow[];
  total?: number;
  error?: string;
}

const PAGE_LIMIT = 25;

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

function formatAmount(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((__, col) => (
            <div key={col} className="h-10 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const appliedStatus = searchParams.get("status") ?? "all";
  const appliedDay = searchParams.get("day") === "today";
  const appliedBookingId = searchParams.get("booking_id") ?? "";
  const appliedOffset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const [status, setStatus] = useState(appliedStatus);
  const [todayOnly, setTodayOnly] = useState(appliedDay);
  const [bookingId, setBookingId] = useState(appliedBookingId);
  const [rows, setRows] = useState<PaymentListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = searchParams.toString();

  useEffect(() => {
    setStatus(appliedStatus);
    setTodayOnly(appliedDay);
    setBookingId(appliedBookingId);
  }, [appliedStatus, appliedDay, appliedBookingId]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = new URL("/api/admin/payments", window.location.origin);
      searchParams.forEach((value, key) => endpoint.searchParams.set(key, value));
      if (!endpoint.searchParams.get("limit")) endpoint.searchParams.set("limit", String(PAGE_LIMIT));

      const response = await fetch(endpoint.toString(), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as PaymentListResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to fetch payments (${response.status})`);
      }
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch payments");
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
    if (!status || status === "all") params.delete("status");
    else params.set("status", status);

    if (todayOnly) params.set("day", "today");
    else params.delete("day");

    if (!bookingId.trim()) params.delete("booking_id");
    else params.set("booking_id", bookingId.trim());

    params.set("limit", String(PAGE_LIMIT));
    params.set("offset", "0");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setStatus("all");
    setTodayOnly(false);
    setBookingId("");
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_LIMIT));
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Payments</h2>
        <p className="text-sm text-slate-500">Admin payment drill-down with status and IST day filters.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="captured">Captured</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="authorized">Authorized</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div className="lg:col-span-5">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Booking ID
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="Search by booking_id"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
              />
            </div>
          </div>

          <div className="flex items-end lg:col-span-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={todayOnly}
                onChange={(e) => setTodayOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#199ce0] focus:ring-[#199ce0]"
              />
              Today (IST)
            </label>
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
                <p className="text-sm font-semibold text-rose-800">Failed to fetch payments</p>
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
            <h3 className="text-sm font-semibold text-slate-900">Payment Results</h3>
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
            No payments found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Payment ID</th>
                  <th className="px-3 py-3 font-semibold">Booking ID</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.id ?? "payment"}-${index}`} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{(row.id ?? "").trim() || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{(row.booking_id ?? "").trim() || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{formatAmount(row.amount ?? null)}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                        {(row.status?.replaceAll("_", " ") || "-").trim()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-3 text-right">
                      {typeof row.id === "string" && row.id.trim() ? (
                        <Link
                          href={`/admin/payments/${encodeURIComponent(row.id.trim())}`}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
