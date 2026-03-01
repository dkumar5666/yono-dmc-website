"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CopyPlus, Loader2, RefreshCw } from "lucide-react";

interface PricingVersionRow {
  id?: string | null;
  version?: number | null;
  status?: string | null;
  created_at?: string | null;
  rule_count?: number | null;
  rule_preview?: string[] | null;
}

interface VersionsResponse {
  rows: PricingVersionRow[];
  total: number;
  active_version_id?: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: string) {
  const normalized = safeString(status).toLowerCase();
  if (normalized === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "draft") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminPricingVersionsPage() {
  const [rows, setRows] = useState<PricingVersionRow[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadVersions = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/pricing/versions", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as VersionsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load pricing versions (${response.status})`);
      }
      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setActiveVersionId(safeString(payload.active_version_id) || null);
    } catch (err) {
      setRows([]);
      setActiveVersionId(null);
      setError(err instanceof Error ? err.message : "Failed to load pricing versions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  async function createVersion() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/pricing/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; version?: { version?: number } };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to create pricing version (${response.status})`);
      }
      setNotice(`Created pricing version v${payload.version?.version ?? "-"}.`);
      await loadVersions({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pricing version");
    } finally {
      setSaving(false);
    }
  }

  async function activateVersion(row: PricingVersionRow) {
    const id = safeString(row.id);
    if (!id) return;
    const confirmed = window.confirm(
      `Activate pricing version v${row.version ?? "-"}? This will set it as the active pricing set.`
    );
    if (!confirmed) return;

    setActivatingId(id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/pricing/versions/${encodeURIComponent(id)}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to activate version (${response.status})`);
      }
      setNotice(`Pricing version v${row.version ?? "-"} activated.`);
      await loadVersions({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate version");
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Pricing Versions</h2>
          <p className="text-sm text-slate-500">Create draft versions and activate pricing sets with confirmation.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void createVersion()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}
            Create New Version
          </button>
          <button
            type="button"
            onClick={() => void loadVersions({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Version History</h3>
          {activeVersionId ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active configured
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
              No active version
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No pricing versions available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Version</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Rules</th>
                  <th className="px-3 py-3 font-semibold">Preview</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const id = safeString(row.id) || `version-${index}`;
                  const status = safeString(row.status) || "draft";
                  const isActive = id === activeVersionId || status.toLowerCase() === "active";
                  return (
                    <tr key={id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">v{row.version ?? "-"}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{typeof row.rule_count === "number" ? row.rule_count : 0}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {Array.isArray(row.rule_preview) && row.rule_preview.length > 0
                          ? row.rule_preview.join(", ")
                          : "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => void activateVersion(row)}
                          disabled={isActive || activatingId === id}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                        >
                          {activatingId === id ? "Activating..." : isActive ? "Active" : "Activate"}
                        </button>
                      </td>
                    </tr>
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
