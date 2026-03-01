"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, Plus, RefreshCw, Search } from "lucide-react";

type LeadStage = "new" | "qualified" | "quote_sent" | "negotiation" | "won" | "lost";
type ViewMode = "kanban" | "table";

interface CrmLeadRow {
  id?: string | null;
  lead_id?: string | null;
  lead_code?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  destination?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  budget?: number | null;
  stage?: LeadStage | null;
  source?: string | null;
  utm_campaign?: string | null;
  assigned_to?: string | null;
  booking_id?: string | null;
  updated_at?: string | null;
}

interface CrmLeadsResponse {
  rows?: CrmLeadRow[];
  total?: number;
  error?: string;
}

const PAGE_LIMIT = 120;
const STAGES: LeadStage[] = ["new", "qualified", "quote_sent", "negotiation", "won", "lost"];

const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  qualified: "Qualified",
  quote_sent: "Quote Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function formatAmount(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function stageBadgeClass(stage: LeadStage) {
  switch (stage) {
    case "new":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "qualified":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "quote_sent":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "negotiation":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "won":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "lost":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function sourceBadgeLabel(value?: string | null): string {
  const raw = safeString(value);
  return raw ? raw.replaceAll("_", " ") : "Unknown";
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((__, col) => (
            <div key={col} className="h-10 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminCrmLeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const appliedView = (safeString(searchParams.get("view")) as ViewMode) || "kanban";
  const appliedStage = safeString(searchParams.get("stage")) || "all";
  const appliedSource = safeString(searchParams.get("source"));
  const appliedAssignedTo = safeString(searchParams.get("assigned_to"));
  const appliedQ = safeString(searchParams.get("q"));
  const appliedFrom = safeString(searchParams.get("from"));
  const appliedTo = safeString(searchParams.get("to"));

  const [viewMode, setViewMode] = useState<ViewMode>(appliedView === "table" ? "table" : "kanban");
  const [stage, setStage] = useState(appliedStage || "all");
  const [source, setSource] = useState(appliedSource);
  const [assignedTo, setAssignedTo] = useState(appliedAssignedTo);
  const [q, setQ] = useState(appliedQ);
  const [fromDate, setFromDate] = useState(appliedFrom);
  const [toDate, setToDate] = useState(appliedTo);
  const [rows, setRows] = useState<CrmLeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    destination: "",
    travel_start_date: "",
    travel_end_date: "",
    budget: "",
    source: "",
    requirements: "",
  });

  const queryKey = searchParams.toString();

  useEffect(() => {
    setViewMode(appliedView === "table" ? "table" : "kanban");
    setStage(appliedStage || "all");
    setSource(appliedSource);
    setAssignedTo(appliedAssignedTo);
    setQ(appliedQ);
    setFromDate(appliedFrom);
    setToDate(appliedTo);
  }, [appliedView, appliedStage, appliedSource, appliedAssignedTo, appliedQ, appliedFrom, appliedTo]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = new URL("/api/admin/crm/leads", window.location.origin);
      searchParams.forEach((value, key) => endpoint.searchParams.set(key, value));
      endpoint.searchParams.set("limit", String(PAGE_LIMIT));
      endpoint.searchParams.delete("offset");

      const response = await fetch(endpoint.toString(), { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as CrmLeadsResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to fetch CRM leads (${response.status})`);
      }

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch CRM leads");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadRows();
  }, [queryKey, loadRows]);

  const grouped = useMemo(() => {
    const base: Record<LeadStage, CrmLeadRow[]> = {
      new: [],
      qualified: [],
      quote_sent: [],
      negotiation: [],
      won: [],
      lost: [],
    };

    for (const row of rows) {
      const stageValue = safeString(row.stage) as LeadStage;
      const normalized: LeadStage = STAGES.includes(stageValue) ? stageValue : "new";
      base[normalized].push(row);
    }

    for (const key of STAGES) {
      base[key].sort((a, b) => {
        const aTime = new Date(a.updated_at || 0).getTime() || 0;
        const bTime = new Date(b.updated_at || 0).getTime() || 0;
        return bTime - aTime;
      });
    }

    return base;
  }, [rows]);

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || !value.trim() || value === "all") params.delete(key);
      else params.set(key, value.trim());
    }
    params.set("limit", String(PAGE_LIMIT));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function applyFilters() {
    updateQuery({
      view: viewMode,
      stage,
      source,
      assigned_to: assignedTo,
      q,
      from: fromDate,
      to: toDate,
    });
  }

  function clearFilters() {
    setStage("all");
    setSource("");
    setAssignedTo("");
    setQ("");
    setFromDate("");
    setToDate("");
    setViewMode("kanban");
    const params = new URLSearchParams();
    params.set("view", "kanban");
    params.set("limit", String(PAGE_LIMIT));
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function createLead() {
    setCreatingLead(true);
    setCreateError(null);
    setCreateNotice(null);

    try {
      const payload = {
        customer_name: createForm.customer_name.trim(),
        customer_email: createForm.customer_email.trim(),
        customer_phone: createForm.customer_phone.trim(),
        destination: createForm.destination.trim(),
        travel_start_date: createForm.travel_start_date || "",
        travel_end_date: createForm.travel_end_date || "",
        budget: createForm.budget.trim(),
        source: createForm.source.trim(),
        requirements: createForm.requirements.trim(),
      };

      const response = await fetch("/api/admin/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        lead?: CrmLeadRow;
        error?: string;
      };
      if (!response.ok || !body.lead) {
        throw new Error(body.error || `Failed to create lead (${response.status})`);
      }

      const leadRef = safeString(body.lead.lead_id) || safeString(body.lead.id);
      setCreateNotice("Lead created successfully.");
      setShowCreatePanel(false);
      setCreateForm({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        destination: "",
        travel_start_date: "",
        travel_end_date: "",
        budget: "",
        source: "",
        requirements: "",
      });
      await loadRows();
      if (leadRef) router.push(`/admin/crm/leads/${encodeURIComponent(leadRef)}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setCreatingLead(false);
    }
  }

  function exportCsv() {
    const headers = [
      "lead_id",
      "customer_name",
      "customer_email",
      "customer_phone",
      "destination",
      "travel_start_date",
      "travel_end_date",
      "budget",
      "stage",
      "source",
      "assigned_to",
      "booking_id",
      "updated_at",
    ];

    const csvRows = rows.map((row) =>
      [
        safeString(row.lead_id) || safeString(row.id),
        safeString(row.customer_name),
        safeString(row.customer_email),
        safeString(row.customer_phone),
        safeString(row.destination),
        safeString(row.travel_start_date),
        safeString(row.travel_end_date),
        row.budget ?? "",
        safeString(row.stage),
        safeString(row.source),
        safeString(row.assigned_to),
        safeString(row.booking_id),
        safeString(row.updated_at),
      ]
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">CRM Pipeline</h2>
          <p className="text-sm text-slate-500">
            Lead to quotation to booking progression for Yono DMC operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreatePanel((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            Create Lead
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void loadRows()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {showCreatePanel ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Create Lead</h3>
            <p className="text-xs text-slate-500">Add a new inquiry directly into the CRM pipeline.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input
              type="text"
              value={createForm.customer_name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_name: e.target.value }))}
              placeholder="Customer name"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="email"
              value={createForm.customer_email}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_email: e.target.value }))}
              placeholder="Customer email"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="text"
              value={createForm.customer_phone}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
              placeholder="Customer phone"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="text"
              value={createForm.destination}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, destination: e.target.value }))}
              placeholder="Destination (e.g. Dubai, UAE)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="date"
              value={createForm.travel_start_date}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, travel_start_date: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="date"
              value={createForm.travel_end_date}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, travel_end_date: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="text"
              value={createForm.budget}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, budget: e.target.value }))}
              placeholder="Budget (INR)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="text"
              value={createForm.source}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, source: e.target.value }))}
              placeholder="Lead source (website, whatsapp, etc.)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <input
              type="text"
              value={createForm.requirements}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, requirements: e.target.value }))}
              placeholder="Requirements / notes"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0] md:col-span-2 lg:col-span-1"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void createLead()}
              disabled={creatingLead}
              className="rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {creatingLead ? "Creating..." : "Save Lead"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreatePanel(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
          {createNotice ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {createNotice}
            </p>
          ) : null}
          {createError ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {createError}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              View
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode((e.target.value as ViewMode) || "kanban")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            >
              <option value="kanban">Kanban</option>
              <option value="table">Table</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Stage
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            >
              <option value="all">All</option>
              {STAGES.map((stageKey) => (
                <option key={stageKey} value={stageKey}>
                  {STAGE_LABELS[stageKey]}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Source
            </label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="website / whatsapp"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Assigned To
            </label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="owner id"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
          </div>
          <div className="lg:col-span-10">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, email, destination, booking id"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#199ce0]"
              />
            </div>
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500">
                <AlertCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-rose-800">Failed to load CRM leads</p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadRows()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Leads</h3>
            <p className="text-xs text-slate-500">{total} lead(s) in pipeline</p>
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No leads found for the selected filters.
          </div>
        ) : viewMode === "kanban" ? (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1080px] grid-cols-6 gap-3">
              {STAGES.map((stageKey) => (
                <div key={stageKey} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {STAGE_LABELS[stageKey]}
                    </span>
                    <span className="text-xs text-slate-500">{grouped[stageKey].length}</span>
                  </div>
                  <div className="space-y-2">
                    {grouped[stageKey].length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-3 text-center text-xs text-slate-400">
                        No leads
                      </div>
                    ) : (
                      grouped[stageKey].map((lead, idx) => {
                        const leadRef = safeString(lead.lead_id) || safeString(lead.id);
                        const card = (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 hover:border-[#199ce0]/40">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-semibold text-slate-900">
                                {leadRef || `Lead ${idx + 1}`}
                              </p>
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${stageBadgeClass(
                                  stageKey
                                )}`}
                              >
                                {STAGE_LABELS[stageKey]}
                              </span>
                            </div>
                            <p className="truncate text-sm font-medium text-slate-800">
                              {safeString(lead.customer_name) || "Unnamed lead"}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {safeString(lead.destination) || "Destination pending"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatDate(lead.travel_start_date)} - {formatDate(lead.travel_end_date)}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-700">{formatAmount(lead.budget)}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {sourceBadgeLabel(lead.source)}
                              </span>
                              {safeString(lead.utm_campaign) ? (
                                <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                                  UTM: {safeString(lead.utm_campaign)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(lead.updated_at)}</p>
                          </div>
                        );

                        return leadRef ? (
                          <Link key={`${leadRef}-${idx}`} href={`/admin/crm/leads/${encodeURIComponent(leadRef)}`}>
                            {card}
                          </Link>
                        ) : (
                          <div key={`lead-${idx}`}>{card}</div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Lead ID</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Destination</th>
                  <th className="px-3 py-3 font-semibold">Travel Dates</th>
                  <th className="px-3 py-3 font-semibold">Budget</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Source</th>
                  <th className="px-3 py-3 font-semibold">Updated</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead, index) => {
                  const stageValue = (safeString(lead.stage) as LeadStage) || "new";
                  const normalizedStage = STAGES.includes(stageValue) ? stageValue : "new";
                  const leadRef = safeString(lead.lead_id) || safeString(lead.id);
                  return (
                    <tr key={`${leadRef || "lead"}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{leadRef || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">
                        <p className="font-medium">{safeString(lead.customer_name) || "-"}</p>
                        <p className="text-xs text-slate-500">{safeString(lead.customer_phone) || safeString(lead.customer_email) || "-"}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{safeString(lead.destination) || "-"}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatDate(lead.travel_start_date)} - {formatDate(lead.travel_end_date)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatAmount(lead.budget)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${stageBadgeClass(
                            normalizedStage
                          )}`}
                        >
                          {STAGE_LABELS[normalizedStage]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {sourceBadgeLabel(lead.source)}
                          </span>
                          {safeString(lead.utm_campaign) ? (
                            <span className="inline-flex w-fit rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                              {safeString(lead.utm_campaign)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(lead.updated_at)}</td>
                      <td className="px-3 py-3 text-right">
                        {leadRef ? (
                          <Link
                            href={`/admin/crm/leads/${encodeURIComponent(leadRef)}`}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
                          >
                            Open
                          </Link>
                        ) : (
                          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-400">
                            -
                          </span>
                        )}
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
