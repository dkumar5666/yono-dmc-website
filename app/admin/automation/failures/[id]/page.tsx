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

interface AutomationFailureDetail {
  id?: string | null;
  booking_id?: string | null;
  event?: string | null;
  status?: string | null;
  attempts?: number | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  payload?: unknown;
  meta?: unknown;
  stack?: string | null;
}

interface AutomationFailureDetailResponse {
  failure: AutomationFailureDetail | null;
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
  if (["retry", "pending", "processing"].some((t) => value.includes(t))) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["resolved", "success", "succeeded"].some((t) => value.includes(t))) return "border-emerald-200 bg-emerald-50 text-emerald-700";
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

function toRetryHistory(meta: unknown): string[] {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const history = (meta as { retry_history?: unknown }).retry_history;
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export default function AdminAutomationFailureDetailPage() {
  const params = useParams<{ id?: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const failureId = useMemo(() => decodeURIComponent(rawId || ""), [rawId]);

  const [data, setData] = useState<AutomationFailureDetailResponse>({ failure: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payloadExpanded, setPayloadExpanded] = useState<Record<string, boolean>>({});
  const [markResolvedLoading, setMarkResolvedLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDetails = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!failureId) {
        setLoading(false);
        setData({ failure: null });
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

        const response = await fetch(`/api/admin/automation/failures/${encodeURIComponent(failureId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as AutomationFailureDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load automation failure (${response.status})`);
        }
        setData({ failure: payload.failure ?? null });
        setActionError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load automation failure");
        setData({ failure: null });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [failureId]
  );

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const failure = data.failure;
  const pageTitle = safeString(failure?.id) || failureId || "Automation Failure";
  const bookingId = safeString(failure?.booking_id);

  const payloadSections = [
    { key: "payload", label: "Payload", value: failure?.payload ?? null },
    { key: "meta", label: "Meta", value: failure?.meta ?? null },
  ].filter((entry) => entry.value != null);
  const retryHistory = toRetryHistory(failure?.meta);

  const markResolved = useCallback(async () => {
    if (!failureId) return;
    setMarkResolvedLoading(true);
    setActionNotice(null);
    setActionError(null);

    try {
      const response = await fetch(
        `/api/admin/automation/failures/${encodeURIComponent(failureId)}/mark-resolved`,
        { method: "POST" }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to mark resolved (${response.status})`);
      }

      setActionNotice(payload.message || "Resolve action recorded.");
      await loadDetails({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record resolve action");
    } finally {
      setMarkResolvedLoading(false);
    }
  }, [failureId, loadDetails]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Automation Failure: {pageTitle}</h2>
            {failure?.status ? <StatusBadge label={failure.status} /> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span>Read-only automation failure detail</span>
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
            href="/admin/automation/failures"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to Failures
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
                <p className="text-sm font-semibold text-rose-800">Failed to load automation failure</p>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Event</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{safeString(failure?.event) || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Attempts</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{failure?.attempts ?? "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Created At</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(failure?.created_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Updated At</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(failure?.updated_at)}</p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Error Details</h3>
          <p className="text-xs text-slate-500">Latest error message and stack (if captured)</p>
        </div>
        {loading ? (
          <div className="space-y-2">
            <SkeletonLine className="h-14" />
            <SkeletonLine className="h-20" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {safeString(failure?.last_error) || "Not available"}
            </div>
            {safeString(failure?.stack) ? (
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
                {safeString(failure?.stack)}
              </pre>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Payload Viewer</h3>
          <p className="text-xs text-slate-500">Payload/context captured for this automation failure</p>
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
              const expanded = Boolean(payloadExpanded[section.key]);
              return (
                <div key={section.key} className="rounded-xl border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setPayloadExpanded((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                      <p className="text-xs text-slate-500">{expanded ? "Hide JSON" : "Show JSON"}</p>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Retry History</h3>
          <p className="text-xs text-slate-500">Captured from failure meta.retry_history</p>
        </div>
        {loading ? (
          <div className="space-y-2">
            <SkeletonLine className="h-10" />
            <SkeletonLine className="h-10" />
          </div>
        ) : retryHistory.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No retry history recorded
          </div>
        ) : (
          <ol className="space-y-2">
            {retryHistory
              .slice()
              .reverse()
              .map((timestamp, index) => (
                <li
                  key={`${timestamp}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-700">Retry attempt</span>
                  <span className="text-slate-600">{formatDateTime(timestamp)}</span>
                </li>
              ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Actions</h3>
          <p className="text-xs text-slate-500">Safe admin actions (scaffold only)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
          >
            Retry Now
          </button>
          <button
            type="button"
            onClick={() => void markResolved()}
            disabled={loading || refreshing || markResolvedLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {markResolvedLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Mark Resolved
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
    </div>
  );
}
