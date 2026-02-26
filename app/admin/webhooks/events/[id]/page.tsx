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

interface WebhookEventDetail {
  id?: string | null;
  provider?: string | null;
  event_id?: string | null;
  event_type?: string | null;
  status?: string | null;
  booking_id?: string | null;
  payment_id?: string | null;
  payload?: unknown;
  created_at?: string | null;
}

interface WebhookEventDetailResponse {
  event: WebhookEventDetail | null;
  error?: string;
}

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

function statusClass(status?: string | null): string {
  const value = safeString(status).toLowerCase();
  if (["failed", "error"].some((t) => value.includes(t))) return "border-rose-200 bg-rose-50 text-rose-700";
  if (value.includes("skip")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["processed", "success"].some((t) => value.includes(t))) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function StatusBadge({ label }: { label?: string | null }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusClass(label)}`}>
      {(safeString(label) || "Not available").replaceAll("_", " ")}
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

export default function AdminWebhookEventDetailPage() {
  const params = useParams<{ id?: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const eventRowId = useMemo(() => decodeURIComponent(rawId || ""), [rawId]);

  const [data, setData] = useState<WebhookEventDetailResponse>({ event: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payloadExpanded, setPayloadExpanded] = useState(false);

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!eventRowId) {
        setLoading(false);
        setData({ event: null });
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

        const response = await fetch(`/api/admin/webhooks/events/${encodeURIComponent(eventRowId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as WebhookEventDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load webhook event (${response.status})`);
        }
        setData({ event: payload.event ?? null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load webhook event");
        setData({ event: null });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventRowId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const event = data.event;
  const title = safeString(event?.event_id) || eventRowId || "Webhook Event";
  const bookingId = safeString(event?.booking_id);
  const paymentId = safeString(event?.payment_id);
  const hasPayload = event?.payload != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Webhook Event: {title}</h2>
            {event?.status ? <StatusBadge label={event.status} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Read-only webhook idempotency record</span>
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
            href="/admin/webhooks/events"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to Webhook Events
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
                <p className="text-sm font-semibold text-rose-800">Failed to load webhook event</p>
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
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Provider</p>
              <p className="mt-2 text-sm font-semibold capitalize text-slate-900">{safeString(event?.provider) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <div className="mt-2">
                <StatusBadge label={event?.status} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Provider Event ID</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-900">{safeString(event?.event_id) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Event Type</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{safeString(event?.event_type) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Record ID</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-900">{safeString(event?.id) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Created At</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(event?.created_at)}</p>
            </div>
          </>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Linked Booking</h3>
              <p className="text-xs text-slate-500">Booking reference captured from webhook processing</p>
            </div>
            {bookingId ? (
              <Link
                href={`/admin/bookings/${encodeURIComponent(bookingId)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                Open Booking
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          {loading ? (
            <SkeletonLine className="h-24" />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Booking ID</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{bookingId || "Not available"}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Linked Payment</h3>
              <p className="text-xs text-slate-500">Payment reference captured from webhook processing</p>
            </div>
            {paymentId ? (
              <Link
                href={`/admin/payments/${encodeURIComponent(paymentId)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                Open Payment
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
          {loading ? (
            <SkeletonLine className="h-24" />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Payment ID</p>
              <p className="mt-2 break-all text-sm font-semibold text-slate-900">{paymentId || "Not available"}</p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Payload</h3>
            <p className="text-xs text-slate-500">Raw webhook payload captured in the idempotency event record</p>
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
          <JsonPreview value={event?.payload} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Payload available. Click &quot;Show JSON&quot; to expand.
          </div>
        )}
      </section>
    </div>
  );
}
