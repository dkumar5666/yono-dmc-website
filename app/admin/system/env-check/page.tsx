"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Loader2, RefreshCw } from "lucide-react";

type IntegrationMode = "production" | "staging" | "test" | "sandbox" | "configured" | "missing";

interface EnvCheckPayload {
  ok: boolean;
  missing: string[];
  warnings: string[];
  modes?: {
    app: IntegrationMode;
    razorpay: IntegrationMode;
    amadeus: IntegrationMode;
    otp: IntegrationMode;
    googleOAuth: IntegrationMode;
    whatsappWebhook: IntegrationMode;
  };
}

const EMPTY_PAYLOAD: EnvCheckPayload = {
  ok: true,
  missing: [],
  warnings: [],
};

function modeBadge(mode: IntegrationMode | undefined): string {
  switch (mode) {
    case "production":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "staging":
    case "test":
    case "sandbox":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "configured":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

export default function AdminEnvCheckPage() {
  const [data, setData] = useState<EnvCheckPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/system/env-check", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as EnvCheckPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to fetch env check (${response.status})`);
      }
      setData({
        ok: Boolean(payload.ok),
        missing: Array.isArray(payload.missing) ? payload.missing : [],
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
        modes: payload.modes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch env check");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checklistText = useMemo(() => {
    const missing = data.missing.length > 0 ? data.missing.join("\n") : "None";
    const warnings = data.warnings.length > 0 ? data.warnings.join("\n") : "None";
    return `Yono DMC Env Check\n\nMissing:\n${missing}\n\nWarnings:\n${warnings}`;
  }, [data.missing, data.warnings]);

  async function copyChecklist() {
    try {
      await navigator.clipboard.writeText(checklistText);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1500);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Environment Check</h2>
          <p className="text-sm text-slate-500">Launch readiness validation (names and modes only).</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyChecklist}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            <Copy className="h-4 w-4" />
            {copyState === "done" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy checklist"}
          </button>
          <button
            type="button"
            onClick={() => void load({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          {data.ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600" />
          )}
          <h3 className="text-sm font-semibold text-slate-900">Integration Modes</h3>
        </div>
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(data.modes ?? {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm capitalize text-slate-700">{key}</span>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${modeBadge(value)}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Missing Variables</h3>
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : data.missing.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              No missing variables.
            </div>
          ) : (
            <ul className="space-y-2">
              {data.missing.map((name) => (
                <li key={name} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Warnings</h3>
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : data.warnings.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              No warnings.
            </div>
          ) : (
            <ul className="space-y-2">
              {data.warnings.map((warning, idx) => (
                <li key={`${warning}-${idx}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

