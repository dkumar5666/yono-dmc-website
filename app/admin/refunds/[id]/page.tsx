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

interface RefundSummary {
  id?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  provider_refund_id?: string | null;
  provider?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  raw?: unknown;
  notes?: unknown;
}

interface LinkedPayment {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  provider?: string | null;
  created_at?: string | null;
  raw?: unknown;
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

interface RefundTimelineEntry {
  id?: string | null;
  event?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string | null;
}

interface RefundDetailResponse {
  refund: RefundSummary | null;
  payment: LinkedPayment | null;
  booking: LinkedBooking | null;
  timeline: RefundTimelineEntry[];
  error?: string;
}

const EMPTY_RESPONSE: RefundDetailResponse = {
  refund: null,
  payment: null,
  booking: null,
  timeline: [],
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

export default function AdminRefundDetailPage() {
  const params = useParams<{ id?: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const refundId = useMemo(() => decodeURIComponent(rawId || ""), [rawId]);

  const [data, setData] = useState<RefundDetailResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payloadExpanded, setPayloadExpanded] = useState(false);

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!refundId) {
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

        const response = await fetch(`/api/admin/refunds/${encodeURIComponent(refundId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as RefundDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load refund (${response.status})`);
        }

        setData({
          refund: payload.refund ?? null,
          payment: payload.payment ?? null,
          booking: payload.booking ?? null,
          timeline: Array.isArray(payload.timeline) ? payload.timeline : [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load refund details");
        setData(EMPTY_RESPONSE);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refundId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const refund = data.refund;
  const payment = data.payment;
  const booking = data.booking;
  const pageTitle = refund?.id || refundId || "Refund";
  const hasPayload = refund?.raw != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Refund: {pageTitle}</h2>
            {refund?.status ? <StatusBadge label={refund.status} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Read-only refund operations view</span>
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
            href="/admin/refunds"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to Refunds
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
                <p className="text-sm font-semibold text-rose-800">Failed to load refund details</p>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {loading ? (
          <>
            <SkeletonLine className="h-28" />
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
                {formatAmount(refund?.amount ?? null, safeString(refund?.currency) || "INR")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <div className="mt-2">
                <StatusBadge label={refund?.status} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Provider</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {safeString(refund?.provider) || "Not available"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Provider Refund ID: {safeString(refund?.provider_refund_id) || "Not available"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Created At</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(refund?.created_at)}</p>
              <p className="mt-1 text-xs text-slate-500">Updated: {formatDateTime(refund?.updated_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Booking</p>
              {safeString(booking?.booking_id || refund?.booking_id) ? (
                <Link
                  href={`/admin/bookings/${encodeURIComponent(safeString(booking?.booking_id || refund?.booking_id))}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#199ce0] hover:underline"
                >
                  {safeString(booking?.booking_id || refund?.booking_id)}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-900">Not available</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Payment</p>
              {safeString(payment?.id || refund?.payment_id) ? (
                <Link
                  href={`/admin/payments/${encodeURIComponent(safeString(payment?.id || refund?.payment_id))}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#199ce0] hover:underline"
                >
                  {safeString(payment?.id || refund?.payment_id)}
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
            <p className="text-xs text-slate-500">Raw provider payload for this refund (if stored)</p>
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
          <JsonPreview value={refund?.raw} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Payload available. Click &quot;Show JSON&quot; to expand.
          </div>
        )}

        {!loading && refund?.notes != null ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Notes</p>
            <div className="mt-2 text-sm text-slate-700">
              {typeof refund.notes === "string" ? safeString(refund.notes) || "Not available" : <JsonPreview value={refund.notes} />}
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Linked Booking</h3>
              <p className="text-xs text-slate-500">Booking context for this refund</p>
            </div>
            {safeString(booking?.booking_id) ? (
              <Link
                href={`/admin/bookings/${encodeURIComponent(safeString(booking?.booking_id))}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                Open Booking
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>

          {loading ? (
            <SkeletonLine className="h-28" />
          ) : !booking ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Not available
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-2">
                {booking.status ? <StatusBadge label={booking.status} /> : null}
                {booking.payment_status ? <StatusBadge label={booking.payment_status} /> : null}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {safeString(booking.customer_name) || "Not available"}
                </p>
                <p className="text-sm text-slate-600">{safeString(booking.customer_email) || "Not available"}</p>
              </div>
              <p className="text-xs text-slate-500">
                Booking amount: {formatAmount(booking.total_amount ?? null, safeString(booking.currency) || "INR")}
              </p>
              <p className="text-xs text-slate-500">Created: {formatDateTime(booking.created_at)}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Linked Payment</h3>
              <p className="text-xs text-slate-500">Payment context used to create this refund</p>
            </div>
            {safeString(payment?.id) ? (
              <Link
                href={`/admin/payments/${encodeURIComponent(safeString(payment?.id))}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                Open Payment
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>

          {loading ? (
            <SkeletonLine className="h-28" />
          ) : !payment ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Not available
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-2">
                {payment.status ? <StatusBadge label={payment.status} /> : null}
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {formatAmount(payment.amount ?? null, safeString(payment.currency) || "INR")}
              </p>
              <p className="text-sm text-slate-600">Provider: {safeString(payment.provider) || "Not available"}</p>
              <p className="text-xs text-slate-500">Created: {formatDateTime(payment.created_at)}</p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
          <p className="text-xs text-slate-500">Refund events / logs (newest first)</p>
        </div>
        {loading ? (
          <>
            <SkeletonLine className="mb-2 h-16" />
            <SkeletonLine className="mb-2 h-16" />
            <SkeletonLine className="h-16" />
          </>
        ) : data.timeline.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No timeline events available
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Actions</h3>
          <p className="text-xs text-slate-500">Actions will be enabled in next phase</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
          >
            Mark as Processed
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
          >
            Resync Provider Status
          </button>
        </div>
      </section>
    </div>
  );
}

