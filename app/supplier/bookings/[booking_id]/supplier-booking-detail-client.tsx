"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface BookingPayload {
  booking_id?: string | null;
  booking_uuid?: string | null;
  status?: string | null;
  payment_status?: string | null;
  supplier_status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
}

interface DetailPayload {
  booking: BookingPayload | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  items?: Array<{
    id?: string | null;
    type?: string | null;
    title?: string | null;
    status?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    amount?: number | null;
    currency?: string | null;
    qty?: number | null;
  }>;
  ground_services?: Array<{
    id?: string | null;
    service_type?: string | null;
    status?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    amount?: number | null;
    currency?: string | null;
    notes?: string | null;
  }>;
  supplier_logs?: Array<{
    id?: string | null;
    action?: string | null;
    status?: string | null;
    message?: string | null;
    created_at?: string | null;
  }>;
  invoices?: Array<{
    id?: string | null;
    type?: string | null;
    name?: string | null;
    status?: string | null;
    url?: string | null;
    created_at?: string | null;
  }>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value?: string | null): string {
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

function formatAmount(amount?: number | null, currency = "INR"): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusBadge({ value }: { value?: string | null }) {
  const label = safeString(value).replaceAll("_", " ") || "-";
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
      {label}
    </span>
  );
}

export default function SupplierBookingDetailClient({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<DetailPayload>({
    booking: null,
    customer: null,
    items: [],
    ground_services: [],
    supplier_logs: [],
    invoices: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [issueMessage, setIssueMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<{
    confirm: boolean;
    complete: boolean;
    issue: boolean;
  }>({
    confirm: false,
    complete: false,
    issue: false,
  });

  const bookingRef = useMemo(() => safeString(bookingId), [bookingId]);

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!bookingRef) {
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/supplier/bookings/${encodeURIComponent(bookingRef)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | (DetailPayload & { error?: string })
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load booking (${response.status})`);
        }
        setData({
          booking: payload?.booking ?? null,
          customer: payload?.customer ?? null,
          items: Array.isArray(payload?.items) ? payload!.items : [],
          ground_services: Array.isArray(payload?.ground_services) ? payload!.ground_services : [],
          supplier_logs: Array.isArray(payload?.supplier_logs) ? payload!.supplier_logs : [],
          invoices: Array.isArray(payload?.invoices) ? payload!.invoices : [],
        });
      } catch (err) {
        setData({
          booking: null,
          customer: null,
          items: [],
          ground_services: [],
          supplier_logs: [],
          invoices: [],
        });
        setError(err instanceof Error ? err.message : "Failed to load booking");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingRef]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const triggerAction = useCallback(
    async (type: "confirm" | "complete" | "issue") => {
      if (!bookingRef) return;
      setActionError(null);
      setActionNotice(null);
      setActionLoading((prev) => ({ ...prev, [type]: true }));
      try {
        const endpoint = `/api/supplier/bookings/${encodeURIComponent(bookingRef)}/${type}`;
        const payload =
          type === "issue"
            ? { message: issueMessage.trim() }
            : { message: `Updated from supplier portal (${type})` };

        if (type === "issue" && !payload.message) {
          throw new Error("Issue message is required");
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(body?.error || `Action failed (${response.status})`);
        }

        setActionNotice(
          body?.message ||
            (type === "confirm"
              ? "Service confirmed"
              : type === "complete"
                ? "Service marked completed"
                : "Issue reported")
        );
        if (type === "issue") setIssueMessage("");
        await loadDetails({ silent: true });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActionLoading((prev) => ({ ...prev, [type]: false }));
      }
    },
    [bookingRef, issueMessage, loadDetails]
  );

  const booking = data.booking;
  const pageTitle = safeString(booking?.booking_id) || bookingRef;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Booking: {pageTitle || "-"}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge value={booking?.supplier_status || booking?.status} />
              <StatusBadge value={booking?.payment_status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/supplier/bookings"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Back to list
            </Link>
            <button
              type="button"
              onClick={() => void loadDetails({ silent: true })}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Failed to load booking</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Total Amount</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {formatAmount(booking?.total_amount ?? null, safeString(booking?.currency) || "INR")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Travel Window</p>
              <p className="mt-2 text-sm text-slate-900">
                {formatDate(booking?.travel_start_date)} - {formatDate(booking?.travel_end_date)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Customer</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{safeString(data.customer?.name) || "-"}</p>
              <p className="mt-1 text-xs text-slate-500">{safeString(data.customer?.phone) || safeString(data.customer?.email) || "-"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Created</p>
              <p className="mt-2 text-sm text-slate-900">{formatDate(booking?.created_at)}</p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Actions</h2>
        <p className="mt-1 text-xs text-slate-500">Confirm service progress and report blockers.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void triggerAction("confirm")}
            disabled={loading || actionLoading.confirm || actionLoading.complete || actionLoading.issue}
            className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {actionLoading.confirm ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm service
          </button>
          <button
            type="button"
            onClick={() => void triggerAction("complete")}
            disabled={loading || actionLoading.confirm || actionLoading.complete || actionLoading.issue}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {actionLoading.complete ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Mark completed
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={issueMessage}
            onChange={(event) => setIssueMessage(event.target.value)}
            placeholder="Report issue to operations team"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void triggerAction("issue")}
            disabled={loading || actionLoading.issue || actionLoading.confirm || actionLoading.complete}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
          >
            {actionLoading.issue ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Report issue
          </button>
        </div>
        {actionNotice ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {actionNotice}
          </p>
        ) : null}
        {actionError ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {actionError}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Service Details</h2>
        <p className="mt-1 text-xs text-slate-500">Assigned booking items and ground services.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Title</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Dates</th>
                <th className="px-3 py-3 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...(data.items ?? []), ...(data.ground_services ?? []).map((row) => ({
                id: row.id,
                type: row.service_type,
                title: row.notes || row.service_type || "Ground service",
                status: row.status,
                start_at: row.start_at,
                end_at: row.end_at,
                amount: row.amount,
                currency: row.currency,
              }))].map((row, index) => (
                <tr key={`${row.id ?? "item"}-${index}`} className="border-b border-slate-100">
                  <td className="px-3 py-3 text-slate-700">{safeString(row.type) || "-"}</td>
                  <td className="px-3 py-3 text-slate-900">{safeString(row.title) || "-"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge value={row.status} />
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {formatDate(row.start_at)} - {formatDate(row.end_at)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {formatAmount(row.amount ?? null, safeString(row.currency) || "INR")}
                  </td>
                </tr>
              ))}
              {(data.items?.length ?? 0) + (data.ground_services?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                    No assigned service lines found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Supplier Logs</h2>
          </div>
          <div className="space-y-2">
            {(data.supplier_logs ?? []).slice(0, 6).map((log, index) => (
              <div key={`${log.id ?? "log"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={log.status} />
                  <p className="text-sm font-medium text-slate-900">{safeString(log.action) || "action"}</p>
                </div>
                <p className="mt-1 text-sm text-slate-700">{safeString(log.message) || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(log.created_at)}</p>
              </div>
            ))}
            {(data.supplier_logs?.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No supplier logs yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Uploaded Invoices</h2>
            <Link href="/supplier/invoices" className="text-xs font-medium text-[#199ce0]">
              Manage invoices
            </Link>
          </div>
          <div className="space-y-2">
            {(data.invoices ?? []).slice(0, 6).map((doc, index) => (
              <div
                key={`${doc.id ?? "invoice"}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{safeString(doc.name) || "Invoice"}</p>
                  <p className="text-xs text-slate-500">{formatDate(doc.created_at)}</p>
                </div>
                {safeString(doc.url) ? (
                  <a
                    href={safeString(doc.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">No file</span>
                )}
              </div>
            ))}
            {(data.invoices?.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No supplier invoices uploaded yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
