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

interface PaymentSummary {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  provider?: string | null;
  created_at?: string | null;
  raw?: unknown;
  provider_payment_id?: string | null;
  receipt?: string | null;
  notes?: unknown;
}

interface LinkedBooking {
  booking_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  created_at?: string | null;
}

interface RefundRow {
  id?: string | null;
  payment_id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  status?: string | null;
  provider_refund_id?: string | null;
  created_at?: string | null;
  raw?: unknown;
}

interface PaymentDetailResponse {
  payment: PaymentSummary | null;
  booking: LinkedBooking | null;
  refunds: RefundRow[];
  error?: string;
}

const EMPTY_RESPONSE: PaymentDetailResponse = {
  payment: null,
  booking: null,
  refunds: [],
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`.trim()} />;
}

function JsonPreview({ value }: { value: unknown }) {
  if (value == null) return null;
  return (
    <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdminPaymentDetailPage() {
  const params = useParams<{ id?: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const paymentId = useMemo(() => decodeURIComponent(rawId || ""), [rawId]);

  const [data, setData] = useState<PaymentDetailResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payloadExpanded, setPayloadExpanded] = useState(false);
  const [expandedRefunds, setExpandedRefunds] = useState<Record<string, boolean>>({});

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!paymentId) {
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

        const response = await fetch(`/api/admin/payments/${encodeURIComponent(paymentId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as PaymentDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load payment (${response.status})`);
        }

        setData({
          payment: payload.payment ?? null,
          booking: payload.booking ?? null,
          refunds: Array.isArray(payload.refunds) ? payload.refunds : [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payment details");
        setData(EMPTY_RESPONSE);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [paymentId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const payment = data.payment;
  const linkedBooking = data.booking;
  const pageTitle = payment?.id || paymentId || "Payment";
  const hasPayload = payment?.raw != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Payment: {pageTitle}</h2>
            {payment?.status ? <StatusBadge label={payment.status} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Read-only payment operations view</span>
            {refreshing ? (
              <span className="inline-flex items-center gap-1.5 text-[#199ce0]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating...
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/payments"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to Payments
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
                <p className="text-sm font-semibold text-rose-800">Failed to load payment details</p>
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
            <SkeletonLine className="h-28" />
            <SkeletonLine className="h-28" />
            <SkeletonLine className="h-28" />
            <SkeletonLine className="h-28" />
            <SkeletonLine className="h-28" />
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Amount</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                {formatAmount(payment?.amount ?? null, safeString(payment?.currency) || "INR")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <div className="mt-2"><StatusBadge label={payment?.status} /></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Provider</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{safeString(payment?.provider) || "Not available"}</p>
              <p className="mt-1 text-xs text-slate-500">Provider Payment ID: {safeString(payment?.provider_payment_id) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Created At</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(payment?.created_at)}</p>
              <p className="mt-1 text-xs text-slate-500">Receipt: {safeString(payment?.receipt) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Booking ID</p>
              {safeString(payment?.booking_id) ? (
                <Link
                  href={`/admin/bookings/${encodeURIComponent(payment!.booking_id!)}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#199ce0] hover:underline"
                >
                  {payment!.booking_id}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-900">Not available</p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Provider Payload</h3>
            <p className="text-xs text-slate-500">Raw payment provider payload (if stored)</p>
          </div>
          {hasPayload ? (
            <button
              type="button"
              onClick={() => setPayloadExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              {payloadExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {payloadExpanded ? "Hide" : "Show"} JSON
            </button>
          ) : null}
        </div>

        {loading ? (
          <SkeletonLine className="h-24" />
        ) : !hasPayload ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No payload stored
          </div>
        ) : payloadExpanded ? (
          <JsonPreview value={payment?.raw} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Payload available. Click &quot;Show JSON&quot; to expand.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Linked Booking</h3>
            <p className="text-xs text-slate-500">Booking context for this payment</p>
          </div>
          {safeString(linkedBooking?.booking_id) ? (
            <Link
              href={`/admin/bookings/${encodeURIComponent(linkedBooking!.booking_id!)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Open Booking
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {loading ? (
          <SkeletonLine className="h-24" />
        ) : !linkedBooking ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Not available
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Booking</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{safeString(linkedBooking.booking_id) || "Not available"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedBooking.status ? <StatusBadge label={linkedBooking.status} /> : null}
                {linkedBooking.payment_status ? <StatusBadge label={linkedBooking.payment_status} /> : null}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatAmount(linkedBooking.total_amount ?? null, safeString(linkedBooking.currency) || "INR")}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Customer</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{safeString(linkedBooking.customer_name) || "Not available"}</p>
              <p className="mt-1 text-sm text-slate-600">{safeString(linkedBooking.customer_email) || "Not available"}</p>
              <p className="mt-2 text-xs text-slate-500">Booking created: {formatDateTime(linkedBooking.created_at)}</p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Refunds</h3>
          <p className="text-xs text-slate-500">Refund records linked by payment ID or booking ID</p>
        </div>

        {loading ? (
          <SkeletonLine className="h-24" />
        ) : data.refunds.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No refunds found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Refund ID</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-3 py-3 font-semibold">Provider Refund ID</th>
                </tr>
              </thead>
              <tbody>
                {data.refunds.map((refund, index) => {
                  const rowKey = refund.id || `refund-${index}`;
                  const hasRaw = refund.raw != null;
                  const expanded = Boolean(expandedRefunds[rowKey]);

                  return (
                    <>
                      <tr
                        key={rowKey}
                        className={`border-b border-slate-100 ${hasRaw ? "cursor-pointer hover:bg-slate-50" : ""}`}
                        onClick={() =>
                          hasRaw
                            ? setExpandedRefunds((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))
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
                            {safeString(refund.id) ? (
                              <Link
                                href={`/admin/refunds/${encodeURIComponent(safeString(refund.id))}`}
                                onClick={(event) => event.stopPropagation()}
                                className="font-medium text-[#199ce0] hover:underline"
                              >
                                {safeString(refund.id)}
                              </Link>
                            ) : (
                              <span>-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {formatAmount(refund.amount ?? null, safeString(payment?.currency) || "INR")}
                        </td>
                        <td className="px-3 py-3"><StatusBadge label={refund.status} /></td>
                        <td className="px-3 py-3 text-slate-600">{formatDateTime(refund.created_at)}</td>
                        <td className="px-3 py-3 text-slate-600">{safeString(refund.provider_refund_id) || "-"}</td>
                      </tr>
                      {expanded && hasRaw ? (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td colSpan={5} className="px-3 py-3">
                            <JsonPreview value={refund.raw} />
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
    </div>
  );
}
