"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

type CheckStatus = "pass" | "warn" | "fail";

interface SmokeCheck {
  name?: string;
  status?: CheckStatus;
  detail?: string;
  action?: string;
}

interface SmokePayload {
  ok: boolean;
  checks: SmokeCheck[];
  meta?: {
    timestamp?: string;
    appMode?: "staging" | "production";
  };
}

const EMPTY_PAYLOAD: SmokePayload = {
  ok: false,
  checks: [],
  meta: {
    timestamp: "",
    appMode: "production",
  },
};

function badgeClass(status: CheckStatus): string {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function label(status: CheckStatus): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function AdminSmokeTestsPage() {
  const [data, setData] = useState<SmokePayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/system/smoke-tests", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as SmokePayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to run smoke tests (${response.status})`);
      }
      setData({
        ok: Boolean(payload.ok),
        checks: Array.isArray(payload.checks) ? payload.checks : [],
        meta: payload.meta ?? { timestamp: "", appMode: "production" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run smoke tests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load({ silent: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const failCount = useMemo(
    () => data.checks.filter((check) => (check.status ?? "fail") === "fail").length,
    [data.checks]
  );
  const warnCount = useMemo(
    () => data.checks.filter((check) => (check.status ?? "warn") === "warn").length,
    [data.checks]
  );

  const decision = useMemo(() => {
    if (failCount > 0) {
      return {
        title: "NOT READY",
        detail: "One or more critical checks failed. Do not go live yet.",
        style: "border-rose-300 bg-rose-100 text-rose-900",
        icon: ShieldAlert,
      };
    }
    if (warnCount > 0) {
      return {
        title: "GO LIVE WITH CAUTION",
        detail: "No hard failures, but warnings should be reviewed before launch.",
        style: "border-amber-300 bg-amber-100 text-amber-900",
        icon: TriangleAlert,
      };
    }
    return {
      title: "READY TO GO LIVE",
      detail: "All smoke checks passed.",
      style: "border-emerald-300 bg-emerald-100 text-emerald-900",
      icon: CheckCircle2,
    };
  }, [failCount, warnCount]);

  const DecisionIcon = decision.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Production Smoke Tests</h2>
          <p className="text-sm text-slate-500">Non-destructive launch readiness checks.</p>
          <p className="mt-1 text-xs text-slate-500">
            Last run: {formatDateTime(data.meta?.timestamp)} | Mode: {data.meta?.appMode ?? "production"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Run Smoke Tests
        </button>
      </div>

      <section className={`rounded-2xl border p-4 shadow-sm ${decision.style}`}>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-current/30 bg-white/60">
            <DecisionIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{decision.title}</p>
            <p className="mt-1 text-sm">{decision.detail}</p>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Smoke tests failed to run</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Checks</h3>
        {loading ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : data.checks.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No checks returned.
          </div>
        ) : (
          <ul className="space-y-3">
            {data.checks.map((check, index) => {
              const status = check.status ?? "warn";
              return (
                <li key={`${check.name ?? "check"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{check.name ?? "Unnamed check"}</p>
                      <p className="mt-1 text-sm text-slate-700">{check.detail ?? "-"}</p>
                      {check.action ? (
                        <p className="mt-2 text-xs font-medium text-slate-600">Action: {check.action}</p>
                      ) : null}
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass(status)}`}>
                      {label(status)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

