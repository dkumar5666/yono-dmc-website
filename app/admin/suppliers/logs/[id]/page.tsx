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

interface SupplierLogDetail {
  id?: string | null;
  booking_id?: string | null;
  supplier?: string | null;
  action?: string | null;
  status?: string | null;
  message?: string | null;
  created_at?: string | null;
  request_payload?: unknown;
  response_payload?: unknown;
  payload?: unknown;
  meta?: unknown;
}

interface SupplierLogDetailResponse {
  log: SupplierLogDetail | null;
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

export default function AdminSupplierLogDetailPage() {
  const params = useParams<{ id?: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const logId = useMemo(() => decodeURIComponent(rawId || ""), [rawId]);

  const [data, setData] = useState<SupplierLogDetailResponse>({ log: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>({});

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!logId) {
        setLoading(false);
        setData({ log: null });
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

        const response = await fetch(`/api/admin/suppliers/logs/${encodeURIComponent(logId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as SupplierLogDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load supplier log (${response.status})`);
        }
        setData({ log: payload.log ?? null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load supplier log details");
        setData({ log: null });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [logId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const log = data.log;
  const pageTitle = safeString(log?.id) || logId || "Supplier Log";
  const bookingId = safeString(log?.booking_id);

  const payloadSections = [
    { key: "request", label: "Request Payload", value: log?.request_payload ?? null },
    { key: "response", label: "Response Payload", value: log?.response_payload ?? null },
    { key: "payload", label: "Payload", value: log?.payload ?? null },
    { key: "meta", label: "Meta", value: log?.meta ?? null },
  ].filter((section) => section.value != null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Supplier Log: {pageTitle}</h2>
            {log?.status ? <StatusBadge label={log.status} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Read-only supplier integration log detail</span>
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
            href="/admin/suppliers/logs"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to Logs
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
                <p className="text-sm font-semibold text-rose-800">Failed to load supplier log details</p>
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
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Supplier</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{safeString(log?.supplier) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Action</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {(safeString(log?.action) || "Not available").replaceAll("_", " ")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Status</p>
              <div className="mt-2">
                <StatusBadge label={log?.status} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Time</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(log?.created_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Booking</p>
              {bookingId ? (
                <Link
                  href={`/admin/bookings/${encodeURIComponent(bookingId)}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#199ce0] hover:underline"
                >
                  {bookingId}
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
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Message</h3>
          <p className="text-xs text-slate-500">Supplier API log message / error summary</p>
        </div>
        {loading ? (
          <SkeletonLine className="h-16" />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {safeString(log?.message) || "Not available"}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Payload Viewer</h3>
          <p className="text-xs text-slate-500">Request/response payloads captured for this supplier log</p>
        </div>

        {loading ? (
          <div className="space-y-2">
            <SkeletonLine className="h-12" />
            <SkeletonLine className="h-24" />
          </div>
        ) : payloadSections.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No payload stored
          </div>
        ) : (
          <div className="space-y-3">
            {payloadSections.map((section) => {
              const expanded = Boolean(sectionsExpanded[section.key]);
              return (
                <div key={section.key} className="rounded-xl border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() =>
                      setSectionsExpanded((prev) => ({ ...prev, [section.key]: !prev[section.key] }))
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                      <p className="text-xs text-slate-500">
                        {expanded ? "Hide JSON payload" : "Show JSON payload"}
                      </p>
                    </div>
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {expanded ? (
                    <div className="border-t border-slate-200 px-3 py-3">
                      <JsonPreview value={section.value} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

