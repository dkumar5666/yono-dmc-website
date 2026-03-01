"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

interface SystemHealthPayload {
  lastCronRetryAt: string | null;
  lastPaymentWebhookAt: string | null;
  failures24h: number;
  pendingSupport: number;
  missingDocuments: number;
  webhookEvents24h: number;
  webhookSkipped24h: number;
  integrationStatus?: {
    cronRetry?: "ok" | "stale" | "unknown";
    paymentWebhook?: "ok" | "stale" | "unknown";
    amadeus?: "ok" | "failed" | "skipped";
    storage?: "ok" | "failed" | "skipped";
  };
}

const EMPTY_PAYLOAD: SystemHealthPayload = {
  lastCronRetryAt: null,
  lastPaymentWebhookAt: null,
  failures24h: 0,
  pendingSupport: 0,
  missingDocuments: 0,
  webhookEvents24h: 0,
  webhookSkipped24h: 0,
  integrationStatus: {
    cronRetry: "unknown",
    paymentWebhook: "unknown",
    amadeus: "skipped",
    storage: "skipped",
  },
};

function formatDateTime(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function isStale(value: string | null, minutes: number): boolean | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return null;
  return Date.now() - ts > minutes * 60 * 1000;
}

function cardStatusStyles(stale: boolean | null) {
  if (stale === null) {
    return {
      badge: "border-slate-200 bg-slate-50 text-slate-600",
      label: "Unknown",
      icon: Clock3,
      iconWrap: "border-slate-200 bg-slate-50 text-slate-500",
    };
  }
  if (stale) {
    return {
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      label: "STALE",
      icon: ShieldAlert,
      iconWrap: "border-rose-200 bg-rose-50 text-rose-600",
    };
  }
  return {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "OK",
    icon: CheckCircle2,
    iconWrap: "border-emerald-200 bg-emerald-50 text-emerald-600",
  };
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 h-4 w-32 animate-pulse rounded bg-slate-200" />
      <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  stale,
}: {
  label: string;
  value: string;
  note: string;
  stale?: boolean | null;
}) {
  const styles = stale === undefined ? null : cardStatusStyles(stale);
  const StatusIcon = styles?.icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{note}</p>
        </div>
        {styles && StatusIcon ? (
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${styles.iconWrap}`}>
              <StatusIcon className="h-4 w-4" />
            </span>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles.badge}`}>
              {styles.label}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminSystemHealthPage() {
  const [data, setData] = useState<SystemHealthPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const inFlightRef = useRef(false);

  const loadHealth = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (silent) setRefreshing(true);
    else setLoading(true);

    setError(null);
    try {
      const response = await fetch("/api/admin/system/health", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Partial<SystemHealthPayload> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to fetch system health (${response.status})`);
      }

      setData({
        lastCronRetryAt: typeof payload.lastCronRetryAt === "string" ? payload.lastCronRetryAt : null,
        lastPaymentWebhookAt:
          typeof payload.lastPaymentWebhookAt === "string" ? payload.lastPaymentWebhookAt : null,
        failures24h: Number(payload.failures24h ?? 0),
        pendingSupport: Number(payload.pendingSupport ?? 0),
        missingDocuments: Number(payload.missingDocuments ?? 0),
        webhookEvents24h: Number(payload.webhookEvents24h ?? 0),
        webhookSkipped24h: Number(payload.webhookSkipped24h ?? 0),
        integrationStatus: payload.integrationStatus,
      });
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch system health");
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadHealth();
    const intervalId = window.setInterval(() => {
      void loadHealth({ silent: true });
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [loadHealth]);

  const cronStale = useMemo(() => isStale(data.lastCronRetryAt, 15), [data.lastCronRetryAt]);
  const webhookStale = useMemo(() => isStale(data.lastPaymentWebhookAt, 60), [data.lastPaymentWebhookAt]);
  const hardFail = cronStale === true || webhookStale === true;

  const incidentChecklist = useMemo(
    () =>
      [
        "Incident Checklist (Yono DMC)",
        "1) Verify payment webhook freshness and delivery logs.",
        "2) Verify cron retry freshness and last execution summary.",
        "3) Open automation failures queue and check latest failed events.",
        "4) Run retry endpoint manually for blocked failures if needed.",
        "5) Resolve or mark resolved only after verification in logs.",
      ].join("\n"),
    []
  );

  async function copyIncidentChecklist() {
    try {
      await navigator.clipboard.writeText(incidentChecklist);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1500);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">System Health</h2>
          <p className="text-sm text-slate-500">Operational heartbeat and queue health for production services.</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Last updated: {formatTime(lastUpdatedAt)}</span>
            {refreshing ? (
              <span className="inline-flex items-center gap-1.5 text-[#199ce0]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating...
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadHealth({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
        <button
          type="button"
          onClick={() => void copyIncidentChecklist()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300"
        >
          {copyState === "done" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy Incident Checklist"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-rose-800">Failed to load System Health</p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadHealth()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {hardFail ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-100 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300 bg-white text-rose-600">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-rose-900">System Health Hard Fail</p>
              <p className="mt-1 text-sm text-rose-800">
                {cronStale === true && webhookStale === true
                  ? "Cron retry and payment webhook heartbeats are stale."
                  : cronStale === true
                    ? "Cron retry heartbeat is stale."
                    : "Payment webhook heartbeat is stale."}{" "}
                Check scheduler and webhook delivery immediately.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard
              label="Last Cron Retry"
              value={formatDateTime(data.lastCronRetryAt)}
              note="Retry worker heartbeat (stale > 15 min)"
              stale={cronStale}
            />
            <MetricCard
              label="Last Payment Webhook"
              value={formatDateTime(data.lastPaymentWebhookAt)}
              note="Webhook heartbeat (stale > 60 min)"
              stale={webhookStale}
            />
            <MetricCard
              label="Failures (24h)"
              value={String(data.failures24h)}
              note="Automation/event failures in last 24 hours"
            />
            <MetricCard
              label="Open Support"
              value={String(data.pendingSupport)}
              note="Open customer requests"
            />
            <MetricCard
              label="Missing Documents"
              value={String(data.missingDocuments)}
              note="Docs missing URL/file or pending/failed"
            />
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Integration Status</h3>
          <p className="text-xs text-slate-500">Runtime checks for launch-critical integrations</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Razorpay Webhook", value: data.integrationStatus?.paymentWebhook ?? "unknown" },
            { label: "Cron Retry", value: data.integrationStatus?.cronRetry ?? "unknown" },
            { label: "Amadeus Token Ping", value: data.integrationStatus?.amadeus ?? "skipped" },
            { label: "Storage Bucket Access", value: data.integrationStatus?.storage ?? "skipped" },
          ].map((item) => {
            const status = item.value;
            const statusClass =
              status === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status === "stale" || status === "failed"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-amber-200 bg-amber-50 text-amber-700";
            return (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                  {status.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Webhook Idempotency (24h)</h3>
          <p className="text-xs text-slate-500">Counts from webhook_events lock table (if available)</p>
        </div>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Webhook Events</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{data.webhookEvents24h}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Skipped Duplicates</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{data.webhookSkipped24h}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
