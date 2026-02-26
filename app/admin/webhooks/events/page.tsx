"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";

interface WebhookEventListRow {
  id?: string | null;
  provider?: string | null;
  event_id?: string | null;
  event_type?: string | null;
  status?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  created_at?: string | null;
}

interface WebhookEventsListResponse {
  rows?: WebhookEventListRow[];
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
  if (value.includes("skip")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["processed", "success"].some((t) => value.includes(t))) {
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

export default function AdminWebhookEventsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const appliedProvider = searchParams.get("provider") ?? "all";
  const appliedStatus = searchParams.get("status") ?? "all";
  const appliedEventType = searchParams.get("event_type") ?? searchParams.get("event") ?? "";
  const appliedBookingId = searchParams.get("booking_id") ?? "";
  const appliedPaymentId = searchParams.get("payment_id") ?? "";
  const appliedQ = searchParams.get("q") ?? "";
  const appliedOffset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const [provider, setProvider] = useState(appliedProvider);
  const [status, setStatus] = useState(appliedStatus);
  const [eventType, setEventType] = useState(appliedEventType);
  const [bookingId, setBookingId] = useState(appliedBookingId);
  const [paymentId, setPaymentId] = useState(appliedPaymentId);
  const [q, setQ] = useState(appliedQ);
  const [rows, setRows] = useState<WebhookEventListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = searchParams.toString();

  useEffect(() => {
    setProvider(appliedProvider);
    setStatus(appliedStatus);
    setEventType(appliedEventType);
    setBookingId(appliedBookingId);
    setPaymentId(appliedPaymentId);
    setQ(appliedQ);
  }, [appliedProvider, appliedStatus, appliedEventType, appliedBookingId, appliedPaymentId, appliedQ]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = new URL("/api/admin/webhooks/events", window.location.origin);
      searchParams.forEach((value, key) => endpoint.searchParams.set(key, value));
      if (!endpoint.searchParams.get("limit")) endpoint.searchParams.set("limit", String(PAGE_LIMIT));

      const response = await fetch(endpoint.toString(), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as WebhookEventsListResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to fetch webhook events (${response.status})`);
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch webhook events");
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
    if (provider && provider !== "all") params.set("provider", provider);
    else params.delete("provider");

    if (status && status !== "all") params.set("status", status);
    else params.delete("status");

    if (eventType.trim()) params.set("event_type", eventType.trim());
    else params.delete("event_type");
    params.delete("event");

    if (bookingId.trim()) params.set("booking_id", bookingId.trim());
    else params.delete("booking_id");

    if (paymentId.trim()) params.set("payment_id", paymentId.trim());
    else params.delete("payment_id");

    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");

    params.set("limit", String(PAGE_LIMIT));
    params.set("offset", "0");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setProvider("all");
    setStatus("all");
    setEventType("");
    setBookingId("");
    setPaymentId("");
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Webhook Events</h2>
        <p className="text-sm text-slate-500">Idempotency lock records for payment/provider webhooks.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            >
              <option value="all">All</option>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
              <option value="manual">Manual</option>
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
              <option value="processed">Processed</option>
              <option value="skipped">Skipped</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Event Type
            </label>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="payment.captured"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            />
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

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Payment ID
            </label>
            <input
              type="text"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="pay_..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
            />
          </div>

          <div className="lg:col-span-7">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search event id, provider, booking, payment..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
              />
            </div>
          </div>

          <div className="flex items-end gap-2 lg:col-span-5">
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
                <p className="text-sm font-semibold text-rose-800">Failed to fetch webhook events</p>
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
            <h3 className="text-sm font-semibold text-slate-900">Webhook Event Results</h3>
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
            No webhook events found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Time</th>
                  <th className="px-3 py-3 font-semibold">Provider</th>
                  <th className="px-3 py-3 font-semibold">Event ID</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Booking</th>
                  <th className="px-3 py-3 font-semibold">Payment</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const id = safeString(row.id);
                  const bookingRef = safeString(row.booking_id);
                  const paymentRef = safeString(row.payment_id);
                  return (
                    <tr key={`${id || "evt"}-${index}`} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-3 font-medium capitalize text-slate-900">
                        {safeString(row.provider) || "-"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[240px] truncate font-mono text-xs text-slate-700">
                          {safeString(row.event_id) || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="max-w-[220px] truncate">{safeString(row.event_type) || "-"}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClass(row.status)}`}
                        >
                          {(safeString(row.status) || "-").replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {bookingRef ? (
                          <Link
                            href={`/admin/bookings/${encodeURIComponent(bookingRef)}`}
                            className="text-[#199ce0] hover:underline"
                          >
                            {bookingRef}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {paymentRef ? (
                          <Link
                            href={`/admin/payments/${encodeURIComponent(paymentRef)}`}
                            className="text-[#199ce0] hover:underline"
                          >
                            {paymentRef}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {id ? (
                          <Link
                            href={`/admin/webhooks/events/${encodeURIComponent(id)}`}
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
