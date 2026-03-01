"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, RefreshCw } from "lucide-react";

type AppliesTo = "hotel" | "transfer" | "activity" | "package" | "visa" | "insurance" | "flight_fee";
type RuleType = "percent" | "fixed";

interface PricingRuleRow {
  id?: string | null;
  name?: string | null;
  applies_to?: AppliesTo | null;
  destination?: string | null;
  supplier?: string | null;
  rule_type?: RuleType | null;
  value?: number | null;
  currency?: string | null;
  priority?: number | null;
  active?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
  created_at?: string | null;
}

interface RulesResponse {
  rows: PricingRuleRow[];
  total: number;
}

const APPLIES_TO_OPTIONS: AppliesTo[] = [
  "package",
  "hotel",
  "transfer",
  "activity",
  "visa",
  "insurance",
  "flight_fee",
];

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

function statusBadge(active: boolean) {
  return active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AdminPricingRulesPage() {
  const [rows, setRows] = useState<PricingRuleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filterAppliesTo, setFilterAppliesTo] = useState<string>("all");
  const [filterDestination, setFilterDestination] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    applies_to: "package" as AppliesTo,
    destination: "",
    supplier: "",
    rule_type: "percent" as RuleType,
    value: "",
    currency: "INR",
    priority: "100",
    active: true,
    valid_from: "",
    valid_to: "",
  });

  const activeFilters = useMemo(
    () => ({
      applies_to: filterAppliesTo,
      destination: filterDestination.trim(),
      active: filterActive,
    }),
    [filterAppliesTo, filterDestination, filterActive]
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm({
      name: "",
      applies_to: "package",
      destination: "",
      supplier: "",
      rule_type: "percent",
      value: "",
      currency: "INR",
      priority: "100",
      active: true,
      valid_from: "",
      valid_to: "",
    });
  }, []);

  const loadRules = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: "200",
          offset: "0",
        });
        if (activeFilters.applies_to !== "all") params.set("applies_to", activeFilters.applies_to);
        if (activeFilters.destination) params.set("destination", activeFilters.destination);
        if (activeFilters.active !== "all") params.set("active", activeFilters.active);

        const response = await fetch(`/api/admin/pricing/rules?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as RulesResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load pricing rules (${response.status})`);
        }
        setRows(Array.isArray(payload.rows) ? payload.rows : []);
        setTotal(typeof payload.total === "number" ? payload.total : 0);
      } catch (err) {
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load pricing rules");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeFilters]
  );

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  async function saveRule() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: form.name,
        applies_to: form.applies_to,
        destination: form.destination || null,
        supplier: form.supplier || null,
        rule_type: form.rule_type,
        value: Number(form.value),
        currency: form.currency || "INR",
        priority: Number(form.priority),
        active: form.active,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
      };

      const endpoint = editingId ? `/api/admin/pricing/rules/${encodeURIComponent(editingId)}` : "/api/admin/pricing/rules";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Failed to save rule (${response.status})`);
      }

      setNotice(editingId ? "Pricing rule updated." : "Pricing rule created.");
      resetForm();
      await loadRules({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pricing rule");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rule: PricingRuleRow) {
    const id = safeString(rule.id);
    if (!id) return;
    setEditingId(id);
    setForm({
      name: safeString(rule.name),
      applies_to: (safeString(rule.applies_to) || "package") as AppliesTo,
      destination: safeString(rule.destination),
      supplier: safeString(rule.supplier),
      rule_type: (safeString(rule.rule_type) || "percent") as RuleType,
      value: typeof rule.value === "number" ? String(rule.value) : "",
      currency: safeString(rule.currency) || "INR",
      priority: typeof rule.priority === "number" ? String(rule.priority) : "100",
      active: rule.active !== false,
      valid_from: safeString(rule.valid_from),
      valid_to: safeString(rule.valid_to),
    });
  }

  async function toggleActive(rule: PricingRuleRow) {
    const id = safeString(rule.id);
    if (!id) return;
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/pricing/rules/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !(rule.active !== false) }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || `Failed to update rule (${response.status})`);
      setNotice(`Rule ${rule.active !== false ? "deactivated" : "activated"}.`);
      await loadRules({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rule");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Pricing Rules</h2>
          <p className="text-sm text-slate-500">Manage markup and fee rules for quotation pricing.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadRules({ silent: true })}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
          <p className="text-xs text-slate-500">Total rules: {total}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={filterAppliesTo}
            onChange={(e) => setFilterAppliesTo(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          >
            <option value="all">All types</option>
            {APPLIES_TO_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={filterDestination}
            onChange={(e) => setFilterDestination(e.target.value)}
            placeholder="Destination"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          >
            <option value="all">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button
            type="button"
            onClick={() => void loadRules({ silent: true })}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {editingId ? "Edit Pricing Rule" : "Create Pricing Rule"}
          </h3>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Rule name"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <select
            value={form.applies_to}
            onChange={(e) => setForm((prev) => ({ ...prev, applies_to: e.target.value as AppliesTo }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          >
            {APPLIES_TO_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={form.rule_type}
            onChange={(e) => setForm((prev) => ({ ...prev, rule_type: e.target.value as RuleType }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          >
            <option value="percent">percent</option>
            <option value="fixed">fixed</option>
          </select>
          <input
            type="number"
            value={form.value}
            onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
            placeholder="Value"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <input
            type="text"
            value={form.destination}
            onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))}
            placeholder="Destination (optional)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <input
            type="text"
            value={form.supplier}
            onChange={(e) => setForm((prev) => ({ ...prev, supplier: e.target.value }))}
            placeholder="Supplier (optional)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <input
            type="text"
            value={form.currency}
            onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
            placeholder="Currency"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <input
            type="number"
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            placeholder="Priority"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <input
            type="datetime-local"
            value={form.valid_from}
            onChange={(e) => setForm((prev) => ({ ...prev, valid_from: e.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <input
            type="datetime-local"
            value={form.valid_to}
            onChange={(e) => setForm((prev) => ({ ...prev, valid_to: e.target.value }))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[#199ce0]"
            />
            Active
          </label>
          <button
            type="button"
            onClick={() => void saveRule()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Update Rule" : "Create Rule"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Rules</h3>
          <p className="text-xs text-slate-500">Sorted by priority (ascending).</p>
        </div>
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No pricing rules available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">Applies To</th>
                  <th className="px-3 py-3 font-semibold">Rule</th>
                  <th className="px-3 py-3 font-semibold">Destination</th>
                  <th className="px-3 py-3 font-semibold">Priority</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((rule, index) => {
                  const id = safeString(rule.id) || `rule-${index}`;
                  const active = rule.active !== false;
                  return (
                    <tr key={id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{safeString(rule.name) || "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{safeString(rule.applies_to) || "-"}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {safeString(rule.rule_type) || "-"} {typeof rule.value === "number" ? rule.value : "-"}{" "}
                        {safeString(rule.currency) || "INR"}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{safeString(rule.destination) || "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{typeof rule.priority === "number" ? rule.priority : 100}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge(active)}`}>
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(rule.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(rule)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(rule)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && rows.length > 0 && !error ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <AlertCircle className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom" />
          Rule precedence: lower priority number is applied first per service type.
        </div>
      ) : null}
    </div>
  );
}
