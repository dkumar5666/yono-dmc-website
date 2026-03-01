"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";

type ActionType = "open_lead" | "open_quote" | "recalc_quote" | "send_followup_now";
type TabKey = "hot_leads" | "quote_optimizer" | "abandoned_payments" | "weekly_insights";

interface RevenueAction {
  type: ActionType;
  label: string;
  payload?: Record<string, unknown>;
}

interface HotLeadItem {
  lead_id: string;
  lead_code: string | null;
  customer_name: string | null;
  destination: string | null;
  stage: string;
  budget: number | null;
  inactivity_hours: number;
  outreach_count: number;
  last_activity_at: string | null;
  suggested_channel?: "call" | "whatsapp" | "email";
  suggested_message?: string;
  actions: RevenueAction[];
}

interface QuoteOpportunityItem {
  lead_id: string;
  lead_code: string | null;
  quote_id: string;
  quote_code: string | null;
  destination: string | null;
  quote_status: string | null;
  current_markup_percent: number | null;
  recommended_markup_percent: number | null;
  suggested_discount_percent: number | null;
  floor_margin_percent: number;
  reason: string;
  stuck_hours: number;
  actions: RevenueAction[];
}

interface AbandonedPaymentItem {
  booking_id: string;
  booking_code: string | null;
  lead_id: string | null;
  payment_id: string;
  amount: number | null;
  currency: string | null;
  payment_status: string | null;
  payment_link: string | null;
  last_reminder_at: string | null;
  reminder_gap_hours: number | null;
  suggestion: string;
  actions: RevenueAction[];
}

interface WeeklyInsights {
  topDestinations: Array<{ destination: string; total_leads: number; won_leads: number }>;
  channelConversion: Array<{ source: string; total: number; won: number; conversion_rate: number }>;
  avgHoursToClose: number | null;
  lossReasons: Array<{ reason: string; count: number }>;
  summary: string;
}

interface OptimizerResponse {
  hotLeads: HotLeadItem[];
  quoteOpportunities: QuoteOpportunityItem[];
  abandonedPayments: AbandonedPaymentItem[];
  insights: WeeklyInsights;
  meta?: {
    generatedAt?: string;
    minMarginPercent?: number;
  };
}

const EMPTY: OptimizerResponse = {
  hotLeads: [],
  quoteOpportunities: [],
  abandonedPayments: [],
  insights: {
    topDestinations: [],
    channelConversion: [],
    avgHoursToClose: null,
    lossReasons: [],
    summary: "",
  },
  meta: {},
};

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

function formatCurrency(value: number | null, currency = "INR"): string {
  if (value === null || !Number.isFinite(value)) return "-";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₹${value.toFixed(0)}`;
  }
}

function actionKey(action: RevenueAction): string {
  const lead = safeString(action.payload?.lead_id);
  const quote = safeString(action.payload?.quote_id);
  const booking = safeString(action.payload?.booking_id);
  return `${action.type}:${lead}:${quote}:${booking}`;
}

function getActionEntity(action: RevenueAction): { entityType: string; entityId: string } {
  const leadId = safeString(action.payload?.lead_id);
  const quoteId = safeString(action.payload?.quote_id);
  const bookingId = safeString(action.payload?.booking_id);
  if (action.type === "open_lead" || action.type === "send_followup_now") {
    return { entityType: "lead", entityId: leadId || "lead" };
  }
  if (action.type === "recalc_quote") {
    return { entityType: "quotation", entityId: quoteId || "quotation" };
  }
  if (bookingId) return { entityType: "booking", entityId: bookingId };
  if (quoteId) return { entityType: "quotation", entityId: quoteId };
  return { entityType: "lead", entityId: leadId || "lead" };
}

export default function AdminRevenueOptimizerPage() {
  const [data, setData] = useState<OptimizerResponse>(EMPTY);
  const [tab, setTab] = useState<TabKey>("hot_leads");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tabs = useMemo(
    () => [
      { key: "hot_leads" as const, label: "Hot Leads", count: data.hotLeads.length },
      { key: "quote_optimizer" as const, label: "Quote Optimizer", count: data.quoteOpportunities.length },
      { key: "abandoned_payments" as const, label: "Abandoned Payments", count: data.abandonedPayments.length },
      { key: "weekly_insights" as const, label: "Weekly Insights", count: 1 },
    ],
    [data]
  );

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/revenue/optimizer", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Partial<OptimizerResponse> & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load revenue optimizer (${response.status})`);
      }
      setData({
        hotLeads: Array.isArray(payload.hotLeads) ? payload.hotLeads : [],
        quoteOpportunities: Array.isArray(payload.quoteOpportunities) ? payload.quoteOpportunities : [],
        abandonedPayments: Array.isArray(payload.abandonedPayments) ? payload.abandonedPayments : [],
        insights: payload.insights ?? EMPTY.insights,
        meta: payload.meta ?? {},
      });
    } catch (err) {
      setData(EMPTY);
      setError(err instanceof Error ? err.message : "Failed to load revenue optimizer.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  async function writeAuditLog(
    action: RevenueAction,
    outcome: "success" | "failed",
    message: string
  ): Promise<void> {
    const target = getActionEntity(action);
    await fetch("/api/admin/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: `revenue_optimizer_${action.type}`,
        entity_type: target.entityType,
        entity_id: target.entityId,
        message,
        meta: {
          outcome,
          action_type: action.type,
          payload: action.payload ?? null,
        },
      }),
    }).catch(() => null);
  }

  async function runAction(action: RevenueAction): Promise<void> {
    const key = actionKey(action);
    const confirmed = window.confirm(
      `Confirm action: "${action.label}"?\n\nThis action is operator-approved only and will be audit logged.`
    );
    if (!confirmed) return;

    setActionLoading(key);
    setError(null);
    setNotice(null);

    try {
      if (action.type === "open_lead") {
        const leadId = safeString(action.payload?.lead_id);
        if (!leadId) throw new Error("Lead id is missing.");
        await writeAuditLog(action, "success", "Revenue optimizer action confirmed: open lead");
        window.location.href = `/admin/crm/leads/${encodeURIComponent(leadId)}`;
        return;
      }

      if (action.type === "open_quote") {
        const leadId = safeString(action.payload?.lead_id);
        const quoteId = safeString(action.payload?.quote_id);
        const bookingId = safeString(action.payload?.booking_id);
        await writeAuditLog(action, "success", "Revenue optimizer action confirmed: open quote/booking");
        if (bookingId) {
          window.location.href = `/admin/bookings/${encodeURIComponent(bookingId)}`;
          return;
        }
        if (leadId && quoteId) {
          window.location.href = `/admin/crm/leads/${encodeURIComponent(leadId)}?quote_id=${encodeURIComponent(quoteId)}`;
          return;
        }
        if (leadId) {
          window.location.href = `/admin/crm/leads/${encodeURIComponent(leadId)}`;
          return;
        }
        if (quoteId) {
          window.location.href = `/admin/crm/leads?q=${encodeURIComponent(quoteId)}`;
          return;
        }
        throw new Error("No navigation target found for this action.");
      }

      if (action.type === "recalc_quote") {
        const quoteId = safeString(action.payload?.quote_id);
        if (!quoteId) throw new Error("Quote id is missing.");
        const response = await fetch("/api/admin/pricing/recalculate-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote_id: quoteId }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || `Failed to recalculate quote (${response.status})`);
        }
        await writeAuditLog(action, "success", "Revenue optimizer action executed: quote recalculated");
        setNotice("Quote recalculated successfully.");
        return;
      }

      if (action.type === "send_followup_now") {
        const leadId = safeString(action.payload?.lead_id);
        if (!leadId) throw new Error("Lead id is missing.");
        const response = await fetch(`/api/admin/crm/leads/${encodeURIComponent(leadId)}/outreach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "revenue_optimizer" }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string; sent?: boolean; skipped?: boolean };
        if (!response.ok) {
          throw new Error(payload.error || `Failed to send follow-up (${response.status})`);
        }
        await writeAuditLog(action, "success", "Revenue optimizer action executed: follow-up triggered");
        if (payload.sent) setNotice("Follow-up sent.");
        else if (payload.skipped) setNotice("Follow-up skipped by scheduler rules.");
        else setNotice("Follow-up processed.");
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed.";
      await writeAuditLog(action, "failed", message);
      setError(message);
    } finally {
      setActionLoading(null);
      await load(true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Revenue Optimizer</h2>
          <p className="mt-1 text-sm text-slate-500">
            Suggestions-only engine for follow-ups, quote tuning, and payment recovery. No automatic price changes are applied.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Suggestions require explicit admin confirmation before any action is executed.
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                tab === entry.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {entry.label}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${tab === entry.key ? "bg-white/20 text-white" : "bg-white text-slate-600"}`}>
                {entry.count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {tab === "hot_leads" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Hot Leads</h3>
            <p className="text-xs text-slate-500">Leads stale for 24+ hours with budget and follow-up capacity.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Lead</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Budget</th>
                  <th className="px-3 py-3 font-semibold">Inactive</th>
                  <th className="px-3 py-3 font-semibold">AI Suggestion</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading hot leads...</td></tr>
                ) : data.hotLeads.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No hot leads found.</td></tr>
                ) : (
                  data.hotLeads.map((lead) => (
                    <tr key={lead.lead_id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <Link href={`/admin/crm/leads/${encodeURIComponent(lead.lead_id)}`} className="font-medium text-[#199ce0] hover:underline">
                          {safeString(lead.lead_code) || lead.lead_id}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{safeString(lead.customer_name) || "-"}</p>
                        <p className="text-xs text-slate-500">{safeString(lead.destination) || "-"}</p>
                      </td>
                      <td className="px-3 py-3 capitalize text-slate-700">{safeString(lead.stage).replaceAll("_", " ") || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">{formatCurrency(lead.budget, "INR")}</td>
                      <td className="px-3 py-3 text-slate-700">{lead.inactivity_hours.toFixed(1)}h</td>
                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                          <Sparkles className="h-3 w-3" />
                          {safeString(lead.suggested_channel) || "whatsapp"}
                        </div>
                        <p className="mt-2 text-xs text-slate-600">{safeString(lead.suggested_message) || "Follow up with customer to progress quote."}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {lead.actions.map((action) => {
                            const key = actionKey(action);
                            return (
                              <button
                                key={`${lead.lead_id}-${key}`}
                                type="button"
                                onClick={() => void runAction(action)}
                                disabled={Boolean(actionLoading)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                {actionLoading === key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "quote_optimizer" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Quote Optimizer</h3>
            <p className="text-xs text-slate-500">Discount suggestions respect margin floor and require confirmation.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Quote</th>
                  <th className="px-3 py-3 font-semibold">Markup</th>
                  <th className="px-3 py-3 font-semibold">Recommended</th>
                  <th className="px-3 py-3 font-semibold">Discount</th>
                  <th className="px-3 py-3 font-semibold">Reason</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading quote opportunities...</td></tr>
                ) : data.quoteOpportunities.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No quote opportunities found.</td></tr>
                ) : (
                  data.quoteOpportunities.map((item) => (
                    <tr key={`${item.quote_id}-${item.lead_id}`} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{safeString(item.quote_code) || item.quote_id}</p>
                        <p className="mt-1 text-xs text-slate-500">{safeString(item.destination) || "-"}</p>
                        <p className="text-xs text-slate-500">Stuck {item.stuck_hours.toFixed(1)}h</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{item.current_markup_percent?.toFixed(2) ?? "-"}%</td>
                      <td className="px-3 py-3 text-slate-700">{item.recommended_markup_percent?.toFixed(2) ?? "-"}%</td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.suggested_discount_percent !== null ? `${item.suggested_discount_percent.toFixed(2)}%` : "-"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{safeString(item.reason) || "-"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.actions.map((action) => {
                            const key = actionKey(action);
                            return (
                              <button
                                key={`${item.quote_id}-${key}`}
                                type="button"
                                onClick={() => void runAction(action)}
                                disabled={Boolean(actionLoading)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                {actionLoading === key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "abandoned_payments" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Abandoned Payments</h3>
            <p className="text-xs text-slate-500">Pending payment link journeys that need nudges.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Booking</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Last Reminder</th>
                  <th className="px-3 py-3 font-semibold">Suggestion</th>
                  <th className="px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Loading abandoned payments...</td></tr>
                ) : data.abandonedPayments.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No abandoned payments found.</td></tr>
                ) : (
                  data.abandonedPayments.map((item) => (
                    <tr key={`${item.payment_id}-${item.booking_id}`} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <Link href={`/admin/bookings/${encodeURIComponent(item.booking_id)}`} className="font-medium text-[#199ce0] hover:underline">
                          {safeString(item.booking_code) || item.booking_id}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">Payment {item.payment_id}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatCurrency(item.amount, safeString(item.currency) || "INR")}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.last_reminder_at ? `${formatDateTime(item.last_reminder_at)} (${(item.reminder_gap_hours ?? 0).toFixed(1)}h)` : "Not sent"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{safeString(item.suggestion)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.actions.map((action) => {
                            const key = actionKey(action);
                            return (
                              <button
                                key={`${item.payment_id}-${key}`}
                                type="button"
                                onClick={() => void runAction(action)}
                                disabled={Boolean(actionLoading)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                {actionLoading === key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "weekly_insights" ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">Weekly AI Summary</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
              {safeString(data.insights.summary) || "No weekly summary available."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Generated at {formatDateTime(safeString(data.meta?.generatedAt) || null)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900">Top Destinations</h4>
            <div className="mt-3 space-y-2">
              {data.insights.topDestinations.length === 0 ? (
                <p className="text-sm text-slate-500">No destination trend data.</p>
              ) : (
                data.insights.topDestinations.map((entry) => (
                  <div key={entry.destination} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="text-slate-700">{entry.destination}</span>
                    <span className="text-slate-500">{entry.won_leads}/{entry.total_leads} won</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900">Channel Conversion</h4>
            <div className="mt-3 space-y-2">
              {data.insights.channelConversion.length === 0 ? (
                <p className="text-sm text-slate-500">No channel conversion data.</p>
              ) : (
                data.insights.channelConversion.map((entry) => (
                  <div key={entry.source} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="text-slate-700">{entry.source}</span>
                    <span className="text-slate-500">{entry.conversion_rate.toFixed(1)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <h4 className="text-sm font-semibold text-slate-900">Loss Reasons</h4>
            <div className="mt-3 space-y-2">
              {data.insights.lossReasons.length === 0 ? (
                <p className="text-sm text-slate-500">No loss reason data available.</p>
              ) : (
                data.insights.lossReasons.map((entry) => (
                  <div key={entry.reason} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="text-slate-700">{entry.reason}</span>
                    <span className="text-slate-500">{entry.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
