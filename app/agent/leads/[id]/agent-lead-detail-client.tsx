"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

type LeadStage = "new" | "qualified" | "quote_sent" | "negotiation" | "won" | "lost";

interface LeadRow {
  id?: string | null;
  lead_id?: string | null;
  lead_code?: string | null;
  stage?: LeadStage | null;
  source?: string | null;
  destination?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  budget?: number | null;
  requirements?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  booking_id?: string | null;
  updated_at?: string | null;
}

interface QuoteRow {
  id?: string | null;
  quotation_id?: string | null;
  quotation_code?: string | null;
  status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  pdf_url?: string | null;
  summary_url?: string | null;
}

interface BookingRow {
  id?: string | null;
  booking_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface NoteRow {
  id?: string;
  message?: string;
  created_at?: string | null;
  created_by?: string | null;
  source?: "lead_notes" | "system_logs";
}

interface LeadDetailResponse {
  lead: LeadRow | null;
  quotations: QuoteRow[];
  booking: BookingRow | null;
  notes: NoteRow[];
  error?: string;
}

const STAGE_OPTIONS: Array<{ value: LeadStage; label: string; disabled?: boolean }> = [
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "quote_sent", label: "Quote Sent", disabled: true },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won", disabled: true },
  { value: "lost", label: "Lost" },
];

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value?: string | null): string {
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

function formatAmount(amount?: number | null, currency = "INR"): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function stageBadgeClass(stage: string): string {
  const normalized = safeString(stage).toLowerCase();
  if (normalized === "new") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "qualified") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (normalized === "quote_sent") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "negotiation") return "border-violet-200 bg-violet-50 text-violet-700";
  if (normalized === "won") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "lost") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AgentLeadDetailClient({ leadId }: { leadId: string }) {
  const leadRef = useMemo(() => safeString(leadId), [leadId]);

  const [data, setData] = useState<LeadDetailResponse>({
    lead: null,
    quotations: [],
    booking: null,
    notes: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<string>("new");
  const [noteText, setNoteText] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [requestingFollowUp, setRequestingFollowUp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
        const response = await fetch(`/api/agent/leads/${encodeURIComponent(leadRef)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as LeadDetailResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load lead (${response.status})`);
        }

        const lead = payload?.lead ?? null;
        setData({
          lead,
          quotations: Array.isArray(payload?.quotations) ? payload!.quotations : [],
          booking: payload?.booking ?? null,
          notes: Array.isArray(payload?.notes) ? payload!.notes : [],
        });
        if (lead?.stage) {
          setStage(lead.stage);
        }
      } catch (err) {
        setData({ lead: null, quotations: [], booking: null, notes: [] });
        setError(err instanceof Error ? err.message : "Failed to load lead");
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

  async function onSaveStage() {
    if (!leadRef || !stage) return;
    setActionError(null);
    setNotice(null);
    setSavingStage(true);
    try {
      const response = await fetch(`/api/agent/leads/${encodeURIComponent(leadRef)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to update stage (${response.status})`);
      }

      setNotice("Lead stage updated.");
      await loadDetail({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update stage");
    } finally {
      setSavingStage(false);
    }
  }

  async function onAddNote(messageOverride?: string) {
    if (!leadRef) return;
    const message = safeString(messageOverride ?? noteText);
    if (!message) {
      setActionError("Please enter a note message.");
      return;
    }

    setActionError(null);
    setNotice(null);
    setSavingNote(true);
    try {
      const response = await fetch(`/api/agent/leads/${encodeURIComponent(leadRef)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to add note (${response.status})`);
      }

      setNotice(messageOverride ? "Follow-up requested." : "Note added.");
      setNoteText("");
      await loadDetail({ silent: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
      setRequestingFollowUp(false);
    }
  }

  async function onRequestFollowUp() {
    if (requestingFollowUp) return;
    setRequestingFollowUp(true);
    await onAddNote("Follow-up requested by agent from lead detail.");
  }

  const lead = data.lead;
  const pageTitle = safeString(lead?.lead_id) || safeString(lead?.id) || leadRef;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Lead: {pageTitle || "-"}</h1>
            <p className="mt-1 text-sm text-slate-500">Track progress from quote request to booking conversion.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${stageBadgeClass(lead?.stage || "")}`}>
                {safeString(lead?.stage).replaceAll("_", " ") || "-"}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                Source: {safeString(lead?.source) || "-"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/agent/leads"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Back to Leads
            </Link>
            <button
              type="button"
              onClick={() => void loadDetail({ silent: true })}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Failed to load lead</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Customer</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{safeString(lead?.customer_name) || "-"}</p>
              <p className="mt-1 text-xs text-slate-500">{safeString(lead?.customer_phone) || safeString(lead?.customer_email) || "-"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Destination</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{safeString(lead?.destination) || "-"}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDate(lead?.travel_start_date)} - {formatDate(lead?.travel_end_date)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Budget</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{formatAmount(lead?.budget ?? null, "INR")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Last Updated</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{formatDate(lead?.updated_at)}</p>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Lead Actions</h2>
        <p className="mt-1 text-xs text-slate-500">Update stage, add notes, or request operations follow-up.</p>

        <div className="mt-3 grid gap-3 lg:grid-cols-[220px_auto_auto]">
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void onSaveStage()}
            disabled={savingStage || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Stage
          </button>
          <button
            type="button"
            onClick={() => void onRequestFollowUp()}
            disabled={requestingFollowUp || savingNote || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {requestingFollowUp ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Request Follow-up
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Add note for operations team"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void onAddNote()}
            disabled={savingNote || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add Note
          </button>
        </div>

        {notice ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
        ) : null}
        {actionError ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Linked Quotations</h2>
            <Link href="/agent/quotes" className="text-xs font-medium text-[#199ce0] hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {data.quotations.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No quotations linked yet.
              </div>
            ) : (
              data.quotations.slice(0, 6).map((quote, index) => (
                <div key={`${quote.id ?? quote.quotation_id ?? "quote"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{safeString(quote.quotation_code) || safeString(quote.quotation_id) || "Quote"}</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${stageBadgeClass(safeString(quote.status) || "qualified")}`}>
                      {safeString(quote.status) || "-"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatAmount(quote.total_amount ?? null, safeString(quote.currency) || "INR")}</p>
                  <p className="mt-1 text-xs text-slate-500">Created {formatDate(quote.created_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {safeString(quote.pdf_url) ? (
                      <a href={safeString(quote.pdf_url)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        Open PDF
                      </a>
                    ) : null}
                    {safeString(quote.summary_url) ? (
                      <a href={safeString(quote.summary_url)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        Open Summary
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Linked Booking</h2>
            <Link href="/agent/bookings" className="text-xs font-medium text-[#199ce0] hover:underline">
              View all
            </Link>
          </div>
          {!data.booking ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              Booking not created yet.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-sm font-medium text-slate-900">{safeString(data.booking.booking_id) || "-"}</p>
              <p className="mt-1 text-xs text-slate-500">Status: {safeString(data.booking.status) || "-"}</p>
              <p className="mt-1 text-xs text-slate-500">Payment: {safeString(data.booking.payment_status) || "-"}</p>
              <p className="mt-1 text-xs text-slate-500">{formatAmount(data.booking.total_amount ?? null, safeString(data.booking.currency) || "INR")}</p>
              {safeString(data.booking.booking_id) ? (
                <Link
                  href={`/agent/bookings/${encodeURIComponent(safeString(data.booking.booking_id))}`}
                  className="mt-3 inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  Open Booking
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Notes Timeline</h2>
        <div className="mt-3 space-y-2">
          {data.notes.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">No notes yet.</div>
          ) : (
            data.notes.slice(0, 20).map((note, index) => (
              <div key={`${note.id ?? "note"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{safeString(note.source) || "note"}</p>
                  <p className="text-xs text-slate-500">{formatDate(note.created_at)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-700">{safeString(note.message) || "-"}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

