"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface SupportRequestDetail {
  id?: string | null;
  booking_id?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  category?: string | null;
  subject?: string | null;
  message?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  meta?: unknown;
}

interface SupportRequestDetailResponse {
  request: SupportRequestDetail | null;
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

function StatusBadge({ status }: { status?: string | null }) {
  const value = safeString(status).toLowerCase();
  const style =
    value === "open"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : value === "closed" || value === "resolved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : value === "pending"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${style}`}>
      {(safeString(status) || "Not available").replaceAll("_", " ")}
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

export default function AdminSupportRequestDetailPage() {
  const params = useParams<{ id?: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const requestId = useMemo(() => decodeURIComponent(rawId || ""), [rawId]);

  const [data, setData] = useState<SupportRequestDetailResponse>({ request: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!requestId) {
        setLoading(false);
        setData({ request: null });
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

        const response = await fetch(`/api/admin/support-requests/${encodeURIComponent(requestId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as SupportRequestDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load support request (${response.status})`);
        }
        setData({ request: payload.request ?? null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load support request");
        setData({ request: null });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const request = data.request;
  const bookingId = safeString(request?.booking_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Support Request: {requestId || "Request"}</h2>
            {request?.status ? <StatusBadge status={request.status} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Customer support ticket detail (read-only v0)</span>
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
            href="/admin/support-requests"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to Requests
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
                <p className="text-sm font-semibold text-rose-800">Failed to load support request</p>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <>
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Customer</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{safeString(request?.customer_email) || "Not available"}</p>
              <p className="mt-1 text-sm text-slate-600">{safeString(request?.customer_phone) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Category / Priority</p>
              <p className="mt-2 text-sm font-semibold capitalize text-slate-900">
                {(safeString(request?.category) || "Not available").replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Priority: {(safeString(request?.priority) || "Not set").replaceAll("_", " ")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Booking</p>
              {bookingId ? (
                <Link
                  href={`/admin/bookings/${encodeURIComponent(bookingId)}`}
                  className="mt-2 inline-flex items-center text-sm font-semibold text-[#199ce0] hover:underline"
                >
                  {bookingId}
                </Link>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-900">Not available</p>
              )}
              <p className="mt-1 text-xs text-slate-500">Created: {formatDateTime(request?.created_at)}</p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Subject</h3>
        </div>
        {loading ? (
          <SkeletonLine className="h-12" />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
            {safeString(request?.subject) || "Not available"}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Message</h3>
        </div>
        {loading ? (
          <SkeletonLine className="h-28" />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 whitespace-pre-wrap">
            {safeString(request?.message) || "Not available"}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Meta</h3>
          <p className="text-xs text-slate-500">Captured metadata (if available)</p>
        </div>
        {loading ? (
          <SkeletonLine className="h-20" />
        ) : request?.meta != null ? (
          <JsonPreview value={request.meta} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Not available
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Actions</h3>
          <p className="text-xs text-slate-500">Scaffold only — enabled in next phase</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
          >
            Mark Resolved
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
          >
            Reply
          </button>
        </div>
      </section>
    </div>
  );
}

