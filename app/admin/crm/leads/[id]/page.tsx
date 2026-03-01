"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from "lucide-react";

type LeadStage = "new" | "qualified" | "quote_sent" | "negotiation" | "won" | "lost";

interface CrmLead {
  id?: string | null;
  lead_id?: string | null;
  lead_code?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  destination?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  budget?: number | null;
  stage?: LeadStage | null;
  source?: string | null;
  assigned_to?: string | null;
  booking_id?: string | null;
  notes?: string | null;
  requirements?: string | null;
  do_not_contact?: boolean;
  outreach_count?: number | null;
  last_outreach_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CrmQuotation {
  id?: string | null;
  quotation_id?: string | null;
  quotation_code?: string | null;
  status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  booking_id?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
}

interface CrmBooking {
  id?: string | null;
  booking_id?: string | null;
  booking_code?: string | null;
  lifecycle_status?: string | null;
  payment_status?: string | null;
  gross_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CrmNote {
  id?: string;
  source?: "lead_notes" | "system_logs";
  message?: string;
  created_at?: string | null;
  created_by?: string | null;
}

interface CrmTimeline {
  id?: string;
  event?: string;
  status?: string | null;
  message?: string;
  created_at?: string | null;
  source?: "system_logs" | "booking_lifecycle_events" | "derived";
}

interface CrmAutomation {
  id?: string;
  event?: string;
  status?: string | null;
  message?: string;
  created_at?: string | null;
  source?: "system_logs";
}

interface CrmLeadDetailResponse {
  lead: CrmLead | null;
  quotations: CrmQuotation[];
  booking: CrmBooking | null;
  notes: CrmNote[];
  timeline: CrmTimeline[];
  automations: CrmAutomation[];
  outreach_history: CrmAutomation[];
  error?: string;
}

const EMPTY_DATA: CrmLeadDetailResponse = {
  lead: null,
  quotations: [],
  booking: null,
  notes: [],
  timeline: [],
  automations: [],
  outreach_history: [],
};

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

function formatAmount(value?: number | null, currency = "INR"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
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

function automationStatusClass(status: string) {
  const normalized = safeString(status).toLowerCase();
  if (normalized === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "failed" || normalized === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "skipped" || normalized === "info") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function StageBadge({ stage }: { stage?: string | null }) {
  const normalized = safeString(stage) as LeadStage;
  const safeStage: LeadStage = STAGES.includes(normalized) ? normalized : "new";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${stageBadgeClass(safeStage)}`}>
      {STAGE_LABELS[safeStage]}
    </span>
  );
}

function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-10 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  );
}

export default function AdminCrmLeadDetailPage() {
  const params = useParams<{ id?: string }>();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const leadRef = useMemo(() => decodeURIComponent(rawId || ""), [rawId]);

  const [data, setData] = useState<CrmLeadDetailResponse>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [converting, setConverting] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [recalculatingQuoteId, setRecalculatingQuoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    stage: "new",
    assigned_to: "",
    destination: "",
    travel_start_date: "",
    travel_end_date: "",
    budget: "",
    requirements: "",
    do_not_contact: false,
  });
  const [noteMessage, setNoteMessage] = useState("");

  const loadDetail = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!leadRef) {
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/crm/leads/${encodeURIComponent(leadRef)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as CrmLeadDetailResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load lead (${response.status})`);
        }

        setData({
          lead: payload.lead ?? null,
          quotations: Array.isArray(payload.quotations) ? payload.quotations : [],
          booking: payload.booking ?? null,
          notes: Array.isArray(payload.notes) ? payload.notes : [],
          timeline: Array.isArray(payload.timeline) ? payload.timeline : [],
          automations: Array.isArray(payload.automations) ? payload.automations : [],
          outreach_history: Array.isArray(payload.outreach_history) ? payload.outreach_history : [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lead details");
        setData(EMPTY_DATA);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leadRef]
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const lead = data.lead;
    if (!lead) return;
    setForm({
      stage: (safeString(lead.stage) as LeadStage) || "new",
      assigned_to: safeString(lead.assigned_to),
      destination: safeString(lead.destination),
      travel_start_date: safeString(lead.travel_start_date),
      travel_end_date: safeString(lead.travel_end_date),
      budget: typeof lead.budget === "number" && Number.isFinite(lead.budget) ? String(lead.budget) : "",
      requirements: safeString(lead.requirements) || safeString(lead.notes),
      do_not_contact: Boolean(lead.do_not_contact),
    });
  }, [data.lead]);

  async function saveLeadSummary() {
    if (!leadRef) return;
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/crm/leads/${encodeURIComponent(leadRef)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: form.stage,
          assigned_to: form.assigned_to,
          destination: form.destination,
          travel_start_date: form.travel_start_date,
          travel_end_date: form.travel_end_date,
          budget: form.budget,
          requirements: form.requirements,
          do_not_contact: form.do_not_contact,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to update lead (${response.status})`);
      }

      setNotice("Lead summary updated.");
      await loadDetail({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lead");
    } finally {
      setSaving(false);
    }
  }

  async function sendFollowupNow() {
    if (!leadRef) return;
    setSendingOutreach(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/crm/leads/${encodeURIComponent(leadRef)}/outreach`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        sent?: boolean;
        skipped?: boolean;
        failed?: boolean;
        reason?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || payload.reason || `Failed to send follow-up (${response.status})`);
      }

      if (payload.sent) setNotice("Follow-up sent.");
      else if (payload.skipped) setNotice(`Follow-up skipped (${safeString(payload.reason) || "not eligible"}).`);
      else if (payload.failed) setNotice("Follow-up attempt failed. Check outreach history.");
      else setNotice("Follow-up processed.");

      await loadDetail({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send follow-up");
    } finally {
      setSendingOutreach(false);
    }
  }

  async function addNote() {
    if (!leadRef || !noteMessage.trim()) return;
    setAddingNote(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/crm/leads/${encodeURIComponent(leadRef)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: noteMessage.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to add note (${response.status})`);
      }

      setNoteMessage("");
      setNotice("Note added.");
      await loadDetail({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setAddingNote(false);
    }
  }

  async function convertToBooking() {
    if (!leadRef) return;
    setConverting(true);
    setNotice(null);
    setError(null);

    try {
      const prioritizedQuotation =
        data.quotations.find((q) => ["approved", "sent"].includes(safeString(q.status).toLowerCase())) ||
        data.quotations[0] ||
        null;
      const quoteId =
        safeString(prioritizedQuotation?.id) ||
        safeString(prioritizedQuotation?.quotation_id) ||
        safeString(prioritizedQuotation?.quotation_code);

      const response = await fetch(
        `/api/admin/crm/leads/${encodeURIComponent(leadRef)}/convert-to-booking`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quoteId ? { quote_id: quoteId } : {}),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        booking_id?: string;
        created?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Failed to convert lead (${response.status})`);
      }

      const bookingRef = safeString(payload.booking_id) || "booking";
      setNotice(
        payload.created === false
          ? `Booking already exists: ${bookingRef}`
          : `Lead converted to booking: ${bookingRef}`
      );
      await loadDetail({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert lead");
    } finally {
      setConverting(false);
    }
  }

  async function recalculateQuotation(quotation: CrmQuotation) {
    const quoteRef =
      safeString(quotation.id) ||
      safeString(quotation.quotation_id) ||
      safeString(quotation.quotation_code);
    if (!quoteRef) return;

    setRecalculatingQuoteId(quoteRef);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/pricing/recalculate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteRef }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        pricing?: { total?: number; currency?: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to recalculate quote (${response.status})`);
      }
      setNotice(
        `Quotation recalculated${
          typeof payload.pricing?.total === "number"
            ? `: ${formatAmount(payload.pricing.total, safeString(payload.pricing?.currency) || "INR")}`
            : "."
        }`
      );
      await loadDetail({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to recalculate quote");
    } finally {
      setRecalculatingQuoteId(null);
    }
  }

  const lead = data.lead;
  const booking = data.booking;
  const pageTitle = safeString(lead?.lead_id) || safeString(lead?.lead_code) || leadRef || "Lead";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Lead: {pageTitle}</h2>
            <StageBadge stage={lead?.stage} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Lead operations workspace with quotations, notes and conversion context.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/crm/leads"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Back to Leads
          </Link>
          <button
            type="button"
            onClick={() => void loadDetail({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-rose-800">CRM lead error</p>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <SkeletonRows rows={1} />
            <SkeletonRows rows={1} />
            <SkeletonRows rows={1} />
            <SkeletonRows rows={1} />
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Budget</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatAmount(lead?.budget ?? null)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Travel Dates</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {formatDate(lead?.travel_start_date)} - {formatDate(lead?.travel_end_date)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Created</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(lead?.created_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Updated</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(lead?.updated_at)}</p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Lead Summary</h3>
          <p className="text-xs text-slate-500">Edit stage, owner, destination, travel dates and requirements.</p>
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : !lead ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Lead not found.
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Stage</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm((prev) => ({ ...prev, stage: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
                >
                  {STAGES.map((stageKey) => (
                    <option key={stageKey} value={stageKey}>
                      {STAGE_LABELS[stageKey]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Assigned To</label>
                <input
                  type="text"
                  value={form.assigned_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
                  placeholder="owner id"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Do not contact</span>
                  <input
                    type="checkbox"
                    checked={form.do_not_contact}
                    onChange={(e) => setForm((prev) => ({ ...prev, do_not_contact: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-[#199ce0] focus:ring-[#199ce0]"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">Outreach automation will skip this lead when enabled.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Destination</label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))}
                  placeholder="Dubai, UAE"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Travel Start</label>
                <input
                  type="date"
                  value={form.travel_start_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, travel_start_date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Travel End</label>
                <input
                  type="date"
                  value={form.travel_end_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, travel_end_date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Budget</label>
                <input
                  type="text"
                  value={form.budget}
                  onChange={(e) => setForm((prev) => ({ ...prev, budget: e.target.value }))}
                  placeholder="Amount in INR"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Requirements</label>
              <textarea
                value={form.requirements}
                onChange={(e) => setForm((prev) => ({ ...prev, requirements: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
                placeholder="Traveler requirements and special notes"
              />
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => void saveLeadSummary()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Customer Info</h3>
          {loading ? (
            <SkeletonRows rows={4} />
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p><span className="font-medium text-slate-900">Name:</span> {safeString(lead?.customer_name) || "Not available"}</p>
              <p><span className="font-medium text-slate-900">Email:</span> {safeString(lead?.customer_email) || "Not available"}</p>
              <p><span className="font-medium text-slate-900">Phone:</span> {safeString(lead?.customer_phone) || "Not available"}</p>
              <p><span className="font-medium text-slate-900">Source:</span> {safeString(lead?.source) || "Not available"}</p>
              <p><span className="font-medium text-slate-900">Do Not Contact:</span> {lead?.do_not_contact ? "Yes" : "No"}</p>
              <p><span className="font-medium text-slate-900">Outreach Count:</span> {typeof lead?.outreach_count === "number" ? lead.outreach_count : 0}</p>
              <p><span className="font-medium text-slate-900">Last Outreach:</span> {formatDateTime(lead?.last_outreach_at)}</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Linked Booking</h3>
          {loading ? (
            <SkeletonRows rows={3} />
          ) : !booking ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No booking linked yet.
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p><span className="font-medium text-slate-900">Booking:</span> {safeString(booking.booking_id) || "Not available"}</p>
              <p><span className="font-medium text-slate-900">Status:</span> {safeString(booking.lifecycle_status) || "Not available"}</p>
              <p><span className="font-medium text-slate-900">Payment:</span> {safeString(booking.payment_status) || "Not available"}</p>
              <p><span className="font-medium text-slate-900">Amount:</span> {formatAmount(booking.gross_amount ?? null, safeString(booking.currency) || "INR")}</p>
              {safeString(booking.booking_id) ? (
                <Link
                  href={`/admin/bookings/${encodeURIComponent(safeString(booking.booking_id))}`}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  Open Booking
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Notes Timeline</h3>
          <p className="text-xs text-slate-500">Internal notes captured in lead_notes or fallback system logs.</p>
        </div>

        <div className="mb-3 flex items-start gap-2">
          <textarea
            rows={2}
            value={noteMessage}
            onChange={(e) => setNoteMessage(e.target.value)}
            placeholder="Add internal note"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
          <button
            type="button"
            onClick={() => void addNote()}
            disabled={addingNote || !noteMessage.trim()}
            className="rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {addingNote ? "Saving..." : "Add Note"}
          </button>
        </div>

        {loading ? (
          <SkeletonRows rows={4} />
        ) : data.notes.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">No notes available.</div>
        ) : (
          <ol className="space-y-2">
            {data.notes.map((note, index) => (
              <li key={`${note.id ?? "note"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm text-slate-800">{safeString(note.message) || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDateTime(note.created_at)} - {safeString(note.created_by) || "system"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Quotations</h3>
          <p className="text-xs text-slate-500">Quotations mapped to this lead.</p>
        </div>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : data.quotations.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">No quotations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Quotation</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Booking</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-3 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.quotations.map((quotation, index) => {
                  const qid = safeString(quotation.quotation_id) || safeString(quotation.quotation_code) || safeString(quotation.id) || "-";
                  const bookingId = safeString(quotation.booking_id);
                  const quoteRef =
                    safeString(quotation.id) ||
                    safeString(quotation.quotation_id) ||
                    safeString(quotation.quotation_code);
                  const isRecalculating = quoteRef && recalculatingQuoteId === quoteRef;
                  return (
                    <tr key={`${qid}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{qid}</td>
                      <td className="px-3 py-3 text-slate-600">{safeString(quotation.status) || "-"}</td>
                      <td className="px-3 py-3 text-slate-600">{formatAmount(quotation.total_amount ?? null, safeString(quotation.currency) || "INR")}</td>
                      <td className="px-3 py-3 text-slate-600">
                        {bookingId ? (
                          <Link className="text-[#199ce0] hover:underline" href={`/admin/bookings/${encodeURIComponent(bookingId)}`}>
                            {bookingId}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(quotation.created_at)}</td>
                      <td className="px-3 py-3">
                        {quoteRef ? (
                          <button
                            type="button"
                            onClick={() => void recalculateQuotation(quotation)}
                            disabled={Boolean(isRecalculating)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                          >
                            {isRecalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Recalculate
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Actions</h3>
          <p className="text-xs text-slate-500">Pipeline actions for operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveLeadSummary()}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Move stage / assign owner
          </button>
          <Link
            href={`/admin/holiday-builder?lead_id=${encodeURIComponent(pageTitle)}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Create Quotation
          </Link>
          <button
            type="button"
            onClick={() => void convertToBooking()}
            disabled={loading || converting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Convert to Booking
          </button>
          <Link
            href={`/admin/support-requests?booking_id=${encodeURIComponent(safeString(booking?.booking_id) || pageTitle)}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Create Support Request
          </Link>
          <button
            type="button"
            onClick={() => void sendFollowupNow()}
            disabled={loading || sendingOutreach}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingOutreach ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send follow-up now
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Outreach History</h3>
          <p className="text-xs text-slate-500">Last 20 outreach attempts and delivery outcomes.</p>
        </div>

        {loading ? (
          <SkeletonRows rows={4} />
        ) : data.outreach_history.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No outreach history available.
          </div>
        ) : (
          <ol className="space-y-2">
            {data.outreach_history.map((entry, index) => (
              <li key={`${entry.id ?? "outreach"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-900">{safeString(entry.event).replaceAll("_", " ") || "event"}</p>
                  <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{safeString(entry.message) || "No details"}</p>
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${automationStatusClass(
                      safeString(entry.status)
                    )}`}
                  >
                    {safeString(entry.status) || "info"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Automations</h3>
          <p className="text-xs text-slate-500">Latest CRM automation events for this lead.</p>
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : data.automations.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No automation events available.
          </div>
        ) : (
          <ol className="space-y-2">
            {data.automations.map((entry, index) => (
              <li key={`${entry.id ?? "automation"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-900">{safeString(entry.event).replaceAll("_", " ") || "event"}</p>
                  <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{safeString(entry.message) || "No details"}</p>
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${automationStatusClass(
                      safeString(entry.status)
                    )}`}
                  >
                    {safeString(entry.status) || "info"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
          <p className="text-xs text-slate-500">System events and lifecycle updates for this lead.</p>
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : data.timeline.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">No timeline events available.</div>
        ) : (
          <ol className="space-y-2">
            {data.timeline.map((entry, index) => (
              <li key={`${entry.id ?? "timeline"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-900">{safeString(entry.event).replaceAll("_", " ") || "event"}</p>
                  <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{safeString(entry.message) || "No details"}</p>
                <p className="mt-1 text-xs text-slate-500">Status: {safeString(entry.status) || "-"}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
