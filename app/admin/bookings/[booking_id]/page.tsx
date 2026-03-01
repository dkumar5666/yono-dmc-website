"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface BookingSummary {
  booking_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
}

interface BookingItemDetail {
  id?: string | null;
  type?: string | null;
  title?: string | null;
  supplier_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  qty?: number | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  meta?: unknown;
}

interface PaymentDetail {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  provider?: string | null;
  created_at?: string | null;
  raw?: unknown;
}

interface DocumentDetail {
  id?: string | null;
  booking_id?: string | null;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface SupplierLogDetail {
  id?: string | null;
  booking_id?: string | null;
  supplier?: string | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string | null;
  payload?: unknown;
}

interface TimelineEntry {
  id?: string | null;
  booking_id?: string | null;
  event?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string | null;
}

interface AdminAuditEntry {
  id?: string | null;
  admin_id?: string | null;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  message?: string | null;
  created_at?: string | null;
  meta?: unknown;
}

interface BookingDetailResponse {
  booking: BookingSummary | null;
  items: BookingItemDetail[];
  payments: PaymentDetail[];
  documents: DocumentDetail[];
  supplier_logs: SupplierLogDetail[];
  timeline: TimelineEntry[];
  error?: string;
}

const EMPTY_RESPONSE: BookingDetailResponse = {
  booking: null,
  items: [],
  payments: [],
  documents: [],
  supplier_logs: [],
  timeline: [],
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value?: number | null, currency = "INR"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatusBadge({ label }: { label?: string | null }) {
  const text = safeString(label).replaceAll("_", " ") || "Not available";
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
      {text}
    </span>
  );
}

function SkeletonBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}

function JsonPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  return (
    <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function extractPaymentLink(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const candidates = [payload.payment_link_url, payload.payment_url, payload.short_url];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function extractPaymentRef(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const candidates = [payload.payment_link_id, payload.provider_order_id, payload.payment_reference];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function summarizeFlightMeta(meta: unknown): string | null {
  const row = toObject(meta);
  if (!row) return null;
  const segments = Array.isArray(row.segments) ? row.segments : [];
  if (segments.length === 0) return null;

  const firstRaw = segments[0];
  const lastRaw = segments[segments.length - 1];
  const first = toObject(firstRaw);
  const last = toObject(lastRaw);
  const from = safeString(first?.from);
  const to = safeString(last?.to);
  const airline =
    safeString(row.airline) ||
    safeString(first?.carrier) ||
    null;
  const duration = safeString(row.duration) || null;

  const parts: string[] = [];
  if (from && to) parts.push(`${from} -> ${to}`);
  if (airline) parts.push(airline);
  if (duration) parts.push(duration);
  return parts.length ? parts.join(" | ") : null;
}

export default function AdminBookingDetailPage() {
  const params = useParams<{ booking_id?: string }>();
  const rawBookingId = typeof params?.booking_id === "string" ? params.booking_id : "";
  const bookingId = useMemo(() => decodeURIComponent(rawBookingId || ""), [rawBookingId]);

  const [data, setData] = useState<BookingDetailResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPayments, setExpandedPayments] = useState<Record<string, boolean>>({});
  const [expandedSupplierLogs, setExpandedSupplierLogs] = useState<Record<string, boolean>>({});
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([]);
  const [actionLoading, setActionLoading] = useState<{
    generateDocuments: boolean;
    resyncSupplier: boolean;
    createPayment: boolean;
  }>({
    generateDocuments: false,
    resyncSupplier: false,
    createPayment: false,
  });
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentLinkState, setPaymentLinkState] = useState<{
    url: string | null;
    orderId: string | null;
    paymentId: string | null;
  }>({
    url: null,
    orderId: null,
    paymentId: null,
  });

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!bookingId) {
        setLoading(false);
        setData(EMPTY_RESPONSE);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const meResponse = await fetch("/api/auth/me");
        if (!meResponse.ok) {
          window.location.href = "/admin/login";
          return;
        }

        const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as BookingDetailResponse;

        if (!response.ok) {
          throw new Error(payload.error || `Failed to load booking (${response.status})`);
        }

        setData({
          booking: payload.booking ?? null,
          items: Array.isArray(payload.items) ? payload.items : [],
          payments: Array.isArray(payload.payments) ? payload.payments : [],
          documents: Array.isArray(payload.documents) ? payload.documents : [],
          supplier_logs: Array.isArray(payload.supplier_logs) ? payload.supplier_logs : [],
          timeline: Array.isArray(payload.timeline) ? payload.timeline : [],
        });

        const latestPaymentWithLink = (Array.isArray(payload.payments) ? payload.payments : []).find(
          (payment) => extractPaymentLink(payment.raw) || safeString(payment.id)
        );
        if (latestPaymentWithLink) {
          setPaymentLinkState((prev) => ({
            url: extractPaymentLink(latestPaymentWithLink.raw) || prev.url,
            orderId:
              extractPaymentRef(latestPaymentWithLink.raw) ||
              safeString(latestPaymentWithLink.id) ||
              prev.orderId,
            paymentId: safeString(latestPaymentWithLink.id) || prev.paymentId,
          }));
        }

        try {
          const auditResponse = await fetch(
            `/api/admin/audit?entity_type=booking&entity_id=${encodeURIComponent(bookingId)}&limit=20`,
            { cache: "no-store" }
          );
          if (auditResponse.ok) {
            const auditPayload = (await auditResponse.json().catch(() => ({}))) as {
              rows?: AdminAuditEntry[];
            };
            setAuditEntries(Array.isArray(auditPayload.rows) ? auditPayload.rows : []);
          }
        } catch {
          // Audit timeline is best-effort only.
          setAuditEntries([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load booking details");
        setData(EMPTY_RESPONSE);
        setAuditEntries([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const booking = data.booking;
  const pageTitle = booking?.booking_id || bookingId || "Booking";
  const supplierInvoices = useMemo(
    () =>
      data.documents.filter((doc) =>
        safeString(doc.type).toLowerCase().includes("supplier_invoice")
      ),
    [data.documents]
  );
  const supplierStatusSummary = useMemo(() => {
    const preferred = data.supplier_logs.find((log) => {
      const action = safeString(log.action).toLowerCase();
      return action.includes("complete") || action.includes("confirm") || action.includes("issue");
    });
    return (
      safeString(preferred?.status) ||
      safeString(booking?.status) ||
      safeString(booking?.payment_status) ||
      null
    );
  }, [booking?.payment_status, booking?.status, data.supplier_logs]);

  const triggerBookingAction = useCallback(
    async (action: "generateDocuments" | "resyncSupplier") => {
      if (!bookingId) return;
      const path =
        action === "generateDocuments"
          ? `/api/admin/bookings/${encodeURIComponent(bookingId)}/generate-documents`
          : `/api/admin/bookings/${encodeURIComponent(bookingId)}/resync-supplier`;

      setActionLoading((prev) => ({ ...prev, [action]: true }));
      setActionNotice(null);
      setActionError(null);

      try {
        const response = await fetch(path, { method: "POST" });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          error?: string;
          generated?: string[];
          skipped?: string[];
          failed?: Array<{ type?: string; error?: string }>;
        };

        if (!response.ok) {
          throw new Error(payload.error || `Action failed (${response.status})`);
        }

        if (action === "generateDocuments") {
          const generatedCount = Array.isArray(payload.generated) ? payload.generated.length : 0;
          const skippedCount = Array.isArray(payload.skipped) ? payload.skipped.length : 0;
          const failedCount = Array.isArray(payload.failed) ? payload.failed.length : 0;
          setActionNotice(
            payload.message ||
              `Documents run complete: generated ${generatedCount}, skipped ${skippedCount}, failed ${failedCount}.`
          );
        } else {
          setActionNotice(payload.message || "Action recorded.");
        }
        await loadDetails({ silent: true });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setActionLoading((prev) => ({ ...prev, [action]: false }));
      }
    },
    [bookingId, loadDetails]
  );

  const createPaymentLink = useCallback(async () => {
    if (!bookingId) return;

    setActionLoading((prev) => ({ ...prev, createPayment: true }));
    setActionNotice(null);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}/create-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        payment_id?: string | null;
        razorpay_order_id?: string | null;
        payment_url?: string | null;
        deduped?: boolean;
        warning?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Failed to create payment link (${response.status})`);
      }

      setPaymentLinkState({
        url: safeString(payload.payment_url) || null,
        orderId: safeString(payload.razorpay_order_id) || null,
        paymentId: safeString(payload.payment_id) || null,
      });

      if (payload.warning) {
        setActionNotice(payload.warning);
      } else if (payload.deduped) {
        setActionNotice("Using existing active payment link for this booking.");
      } else {
        setActionNotice("Payment link created.");
      }

      await loadDetails({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create payment link");
    } finally {
      setActionLoading((prev) => ({ ...prev, createPayment: false }));
    }
  }, [bookingId, loadDetails]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Booking: {pageTitle}</h2>
            {booking?.status ? <StatusBadge label={booking.status} /> : null}
            {booking?.payment_status ? <StatusBadge label={booking.payment_status} /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">Operational booking view (read-only)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/bookings"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to Bookings
          </Link>
          <button
            type="button"
            onClick={() => void loadDetails({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-rose-800">Failed to load booking details</p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadDetails()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {loading ? (
          <>
            <SkeletonBlock rows={1} />
            <SkeletonBlock rows={1} />
            <SkeletonBlock rows={1} />
            <SkeletonBlock rows={1} />
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Total Amount</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatAmount(booking?.total_amount ?? null, safeString(booking?.currency) || "INR")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Created At</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(booking?.created_at)}</p>
              <p className="mt-1 text-xs text-slate-500">Updated: {formatDateTime(booking?.updated_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Customer Name</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {safeString(booking?.customer_name) || "Not available"}
              </p>
              <p className="mt-1 text-xs text-slate-500">ID: {safeString(booking?.customer_id) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Customer Contact</p>
              <p className="mt-2 text-sm text-slate-900">{safeString(booking?.customer_email) || "Not available"}</p>
              <p className="mt-1 text-sm text-slate-600">{safeString(booking?.customer_phone) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Supplier Status</p>
              <div className="mt-2">
                <StatusBadge label={supplierStatusSummary || "pending"} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Supplier logs: {data.supplier_logs.length} | Invoices: {supplierInvoices.length}
              </p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Booking Items</h3>
          <p className="text-xs text-slate-500">Flight / hotel / activity / transfer line items</p>
        </div>
        {loading ? (
          <SkeletonBlock rows={5} />
        ) : data.items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Not available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Title</th>
                  <th className="px-3 py-3 font-semibold">Supplier</th>
                  <th className="px-3 py-3 font-semibold">Dates</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={`${item.id ?? "item"}-${index}`} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-700">{safeString(item.type) || "-"}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{safeString(item.title) || "-"}</p>
                      {safeString(item.type).toLowerCase() === "flight" ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {summarizeFlightMeta(item.meta) || "-"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{safeString(item.supplier_name) || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">
                      <div>{formatDateTime(item.start_date)}</div>
                      <div className="text-xs text-slate-400">{formatDateTime(item.end_date)}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatAmount(item.amount ?? null, safeString(item.currency) || "INR")}
                      <div className="text-xs text-slate-400">Qty: {item.qty ?? "-"}</div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge label={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
          <p className="text-xs text-slate-500">Latest payment records for this booking</p>
        </div>
        {loading ? (
          <SkeletonBlock rows={4} />
        ) : data.payments.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Not available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Payment ID</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Provider</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment, index) => {
                  const rowKey = payment.id || `payment-${index}`;
                  const expanded = Boolean(expandedPayments[rowKey]);
                  const hasRaw = payment.raw != null;

                  return (
                    <>
                      <tr
                        key={rowKey}
                        className={`border-b border-slate-100 ${hasRaw ? "cursor-pointer hover:bg-slate-50" : ""}`}
                        onClick={() =>
                          hasRaw
                            ? setExpandedPayments((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))
                            : undefined
                        }
                      >
                        <td className="px-3 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {hasRaw ? (
                              expanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )
                            ) : null}
                            <span>{safeString(payment.id) || "-"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {formatAmount(payment.amount ?? null, safeString(payment.currency) || "INR")}
                        </td>
                        <td className="px-3 py-3"><StatusBadge label={payment.status} /></td>
                        <td className="px-3 py-3 text-slate-600">{safeString(payment.provider) || "-"}</td>
                        <td className="px-3 py-3 text-slate-600">{formatDateTime(payment.created_at)}</td>
                      </tr>
                      {expanded && hasRaw ? (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td colSpan={5} className="px-3 py-3">
                            <JsonPreview value={payment.raw} />
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Documents</h3>
          <p className="text-xs text-slate-500">Invoice, voucher, itinerary, tickets and other generated files</p>
        </div>
        {loading ? (
          <SkeletonBlock rows={4} />
        ) : data.documents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Not available
          </div>
        ) : (
          <div className="space-y-2">
            {data.documents.map((doc, index) => (
              <div
                key={`${doc.id ?? "doc"}-${index}`}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={doc.type} />
                    {doc.status ? <StatusBadge label={doc.status} /> : null}
                    <p className="truncate text-sm font-medium text-slate-900">{safeString(doc.name) || "-"}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(doc.created_at)}</p>
                </div>
                {safeString(doc.url) ? (
                  <a
                    href={doc.url!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
                  >
                    Open
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-sm text-slate-400">No link</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Supplier Invoices
            </h4>
            {supplierInvoices.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No supplier invoices uploaded yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {supplierInvoices.map((doc, index) => (
                  <div
                    key={`${doc.id ?? "supplier-invoice"}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {safeString(doc.name) || safeString(doc.id) || "Supplier invoice"}
                      </p>
                      <p className="text-xs text-slate-500">{formatDateTime(doc.created_at)}</p>
                    </div>
                    {safeString(doc.url) ? (
                      <a
                        href={doc.url!}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300"
                      >
                        Open
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">No link</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Supplier Logs</h3>
            <p className="text-xs text-slate-500">Supplier communication / callback / action logs (if available)</p>
          </div>
          {bookingId ? (
            <Link
              href={`/admin/suppliers/logs?booking_id=${encodeURIComponent(bookingId)}`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            >
              View all supplier logs
            </Link>
          ) : null}
        </div>
        {loading ? (
          <SkeletonBlock rows={4} />
        ) : data.supplier_logs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Not available
          </div>
        ) : (
          <div className="space-y-2">
            {data.supplier_logs.map((log, index) => {
              const rowKey = log.id || `supplier-log-${index}`;
              const expanded = Boolean(expandedSupplierLogs[rowKey]);
              const hasPayload = log.payload != null;

              return (
                <div key={rowKey} className="rounded-xl border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() =>
                      hasPayload
                        ? setExpandedSupplierLogs((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))
                        : undefined
                    }
                    className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                    disabled={!hasPayload}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{safeString(log.supplier) || "-"}</p>
                        <StatusBadge label={log.status} />
                        <span className="text-xs text-slate-500">{formatDateTime(log.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {(safeString(log.action) || "action").replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{safeString(log.message) || "No message"}</p>
                    </div>
                    {hasPayload ? (
                      expanded ? (
                        <ChevronDown className="mt-1 h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="mt-1 h-4 w-4 text-slate-400" />
                      )
                    ) : null}
                  </button>
                  {expanded && hasPayload ? (
                    <div className="border-t border-slate-200 px-3 py-3">
                      <JsonPreview value={log.payload} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Actions</h3>
          <p className="text-xs text-slate-500">Safe admin actions for payment links, documents and supplier sync</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void createPaymentLink()}
            disabled={loading || refreshing || actionLoading.createPayment}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading.createPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Payment Link
          </button>
          <button
            type="button"
            onClick={() => void triggerBookingAction("generateDocuments")}
            disabled={
              loading ||
              refreshing ||
              actionLoading.generateDocuments ||
              actionLoading.resyncSupplier ||
              actionLoading.createPayment
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading.generateDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate Documents
          </button>
          <button
            type="button"
            onClick={() => void triggerBookingAction("resyncSupplier")}
            disabled={
              loading ||
              refreshing ||
              actionLoading.resyncSupplier ||
              actionLoading.generateDocuments ||
              actionLoading.createPayment
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionLoading.resyncSupplier ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Resync Supplier
          </button>
        </div>
        {paymentLinkState.orderId || paymentLinkState.url ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-sm font-medium text-slate-900">
              Payment Ref: {paymentLinkState.orderId || paymentLinkState.paymentId || "Not available"}
            </p>
            <p className="mt-1 text-sm text-slate-600 break-all">
              Payment Link: {paymentLinkState.url || "Not available"}
            </p>
            {paymentLinkState.url ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={paymentLinkState.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Open Link
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (!paymentLinkState.url) return;
                    void navigator.clipboard?.writeText(paymentLinkState.url);
                    setActionNotice("Payment link copied.");
                  }}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Copy Payment Link
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
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
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
          <p className="text-xs text-slate-500">Booking event history and lifecycle markers</p>
        </div>
        {loading ? (
          <SkeletonBlock rows={5} />
        ) : data.timeline.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Not available
          </div>
        ) : (
          <ol className="space-y-3">
            {data.timeline.map((entry, index) => (
              <li key={`${entry.id ?? "timeline"}-${index}`} className="relative pl-6">
                <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[#199ce0]" />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {(safeString(entry.event) || "event").replaceAll("_", " ")}
                      </p>
                      {entry.status ? <StatusBadge label={entry.status} /> : null}
                    </div>
                    <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{safeString(entry.message) || "No details"}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-slate-900">Manual Admin Actions</h4>
            <p className="text-xs text-slate-500">Audit trail for admin-triggered actions on this booking</p>
          </div>

          {loading ? (
            <SkeletonBlock rows={3} />
          ) : auditEntries.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No manual actions recorded
            </div>
          ) : (
            <ul className="space-y-2">
              {auditEntries.map((entry, index) => (
                <li
                  key={`${entry.id ?? "audit"}-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <StatusBadge label={entry.action || "admin_action"} />
                      <span className="truncate text-sm font-medium text-slate-900">
                        {safeString(entry.message) || "Manual admin action recorded"}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
