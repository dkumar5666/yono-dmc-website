"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";

interface SupplierLogListRow {
  id?: string | null;
  booking_id?: string | null;
  supplier?: string | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string | null;
  duration_ms?: number | null;
  request_id?: string | null;
}

interface SupplierLogsListResponse {
  rows?: SupplierLogListRow[];
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
  if (["failed", "fail", "error"].some((token) => value.includes(token))) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (["pending", "processing", "queued"].some((token) => value.includes(token))) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["success", "succeeded", "ok", "processed"].some((token) => value.includes(token))) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
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

export default function AdminSupplierLogsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const appliedBookingId = searchParams.get("booking_id") ?? "";
  const appliedSupplier = searchParams.get("supplier") ?? "";
  const appliedAction = searchParams.get("action") ?? "all";
  const appliedStatus = searchParams.get("status") ?? "all";
  const appliedQ = searchParams.get("q") ?? "";
  const appliedOffset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const [bookingId, setBookingId] = useState(appliedBookingId);
  const [supplier, setSupplier] = useState(appliedSupplier);
  const [action, setAction] = useState(appliedAction);
  const [status, setStatus] = useState(appliedStatus);
  const [q, setQ] = useState(appliedQ);
  const [rows, setRows] = useState<SupplierLogListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = searchParams.toString();

  useEffect(() => {
    setBookingId(appliedBookingId);
    setSupplier(appliedSupplier);
    setAction(appliedAction);
    setStatus(appliedStatus);
    setQ(appliedQ);
  }, [appliedBookingId, appliedSupplier, appliedAction, appliedStatus, appliedQ]);

  const supplierOptions = useMemo(() => {
    const values = Array.from(new Set(rows.map((row) => safeString(row.supplier)).filter(Boolean)));
    return values.slice(0, 50);
  }, [rows]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = new URL("/api/admin/suppliers/logs", window.location.origin);
      searchParams.forEach((value, key) => endpoint.searchParams.set(key, value));
      if (!endpoint.searchParams.get("limit")) endpoint.searchParams.set("limit", String(PAGE_LIMIT));

      const response = await fetch(endpoint.toString(), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as SupplierLogsListResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to fetch supplier logs (${response.status})`);
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch supplier logs");
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

    if (bookingId.trim()) params.set("booking_id", bookingId.trim());
    else params.delete("booking_id");

    if (supplier.trim()) params.set("supplier", supplier.trim());
    else params.delete("supplier");

    if (action && action !== "all") params.set("action", action);
    else params.delete("action");

    if (status && status !== "all") params.set("status", status);
    else params.delete("status");

    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");

    params.set("limit", String(PAGE_LIMIT));
    params.set("offset", "0");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setBookingId("");
    setSupplier("");
    setAction("all");
    setStatus("all");
    setQ("");
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Supplier Logs</h2>
        <p className="text-sm text-slate-500">Search supplier API activity across bookings and actions.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12">
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
              Supplier
            </label>
            <input
              list="supplier-log-suppliers"
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Supplier name/code"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            />
            <datalist id="supplier-log-suppliers">
              {supplierOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            >
              <option value="all">All</option>
              <option value="search">Search</option>
              <option value="price">Price</option>
              <option value="book">Book</option>
              <option value="cancel">Cancel</option>
              <option value="confirm">Confirm</option>
            </select>
          </div>

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
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Message / action / supplier"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
              />
            </div>
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
                <p className="text-sm font-semibold text-rose-800">Failed to fetch supplier logs</p>
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
            <h3 className="text-sm font-semibold text-slate-900">Supplier Log Results</h3>
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
            No supplier logs found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Time</th>
                  <th className="px-3 py-3 font-semibold">Booking ID</th>
                  <th className="px-3 py-3 font-semibold">Supplier</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Message</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const rowId = safeString(row.id);
                  const rowBookingId = safeString(row.booking_id);
                  return (
                    <tr key={`${rowId || "supplier-log"}-${index}`} className="border-b border-slate-100">
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
                      <td className="px-3 py-3 font-medium text-slate-900">{safeString(row.supplier) || "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{safeString(row.action) || "-"}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClass(
                            row.status
                          )}`}
                        >
                          {(safeString(row.status) || "-").replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <div
                          className="max-w-[320px] truncate"
                          title={safeString(row.message) || undefined}
                        >
                          {safeString(row.message) || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {rowId ? (
                          <Link
                            href={`/admin/suppliers/logs/${encodeURIComponent(rowId)}`}
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

