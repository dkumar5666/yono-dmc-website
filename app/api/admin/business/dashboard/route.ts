import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { countOpenSupportRequestsLast30Days } from "@/lib/backend/supportRequests";

type LeadStage = "new" | "qualified" | "quote_sent" | "negotiation" | "won" | "lost";
type Severity = "info" | "warn" | "error";
type Priority = "low" | "medium" | "high";

interface LeadRow {
  id?: string | null;
  lead_code?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}
interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  payment_status?: string | null;
  gross_amount?: number | string | null;
  paid_amount?: number | string | null;
  due_amount?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
interface PaymentRow {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
}
interface QuoteRow {
  id?: string | null;
  lead_id?: string | null;
  created_at?: string | null;
}
interface LeadNoteRow {
  lead_id?: string | null;
  created_at?: string | null;
}
interface LogRow {
  entity_type?: string | null;
  entity_id?: string | null;
  event?: string | null;
  created_at?: string | null;
  meta?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}
interface DocRow {
  public_url?: string | null;
  url?: string | null;
  file_url?: string | null;
  status?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
}

const TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const EMPTY = {
  kpis: {
    revenueToday: 0,
    revenueMonth: 0,
    conversionRate30d: 0,
    avgBookingValue: 0,
    pendingRevenue: 0,
    leadsToday: 0,
    quotesSentToday: 0,
    paymentsPending: 0,
  },
  funnel: {
    windowDays: 30,
    counts: { new: 0, qualified: 0, quote_sent: 0, negotiation: 0, won: 0 },
    conversions: {
      newToQualified: 0,
      qualifiedToQuoteSent: 0,
      quoteSentToNegotiation: 0,
      negotiationToWon: 0,
      overall: 0,
    },
  },
  alerts: [] as Array<{ key: string; severity: Severity; message: string; count: number; href: string }>,
  dailyTasks: [] as Array<{ key: string; title: string; detail: string; href: string; priority: Priority }>,
  trends: { leads7d: [] as Array<{ date: string; label: string; value: number }>, revenue7d: [] as Array<{ date: string; label: string; value: number }> },
  performance: { avgLeadResponseHours: null as number | null, avgQuoteTurnaroundHours: null as number | null, avgPaymentCompletionHours: null as number | null },
  meta: { generatedAt: "", timezone: "Asia/Kolkata" as const },
};

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const n = (v: unknown) => (typeof v === "number" ? (Number.isFinite(v) ? v : null) : typeof v === "string" ? (Number.isFinite(Number(v)) ? Number(v) : null) : null);
const o = (v: unknown) => (!v || typeof v !== "object" || Array.isArray(v) ? null : (v as Record<string, unknown>));
const t = (v: unknown) => {
  const m = s(v);
  if (!m) return null;
  const x = new Date(m).getTime();
  return Number.isFinite(x) ? x : null;
};
const round = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);
const avg = (values: number[]) => (values.length ? values.reduce((x, y) => x + y, 0) / values.length : null);
const lower = (v: unknown) => s(v).toLowerCase();

const dayWindow = (now = new Date()) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const y = Number(p.find((x) => x.type === "year")?.value);
  const m = Number(p.find((x) => x.type === "month")?.value);
  const d = Number(p.find((x) => x.type === "day")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { startUtc: start.toISOString(), endUtc: new Date(start.getTime() + DAY_MS - 1).toISOString() };
  }
  const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS;
  return { startUtc: new Date(start).toISOString(), endUtc: new Date(start + DAY_MS - 1).toISOString() };
};
const monthWindow = (now = new Date()) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = Number(p.find((x) => x.type === "year")?.value);
  const m = Number(p.find((x) => x.type === "month")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return { startUtc: now.toISOString(), endUtc: now.toISOString() };
  const start = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  const end = Date.UTC(y, m, 1, 0, 0, 0, 0) - IST_OFFSET_MS - 1;
  return { startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString() };
};
const dateKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dateLabel = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "short" }).format(new Date(iso));
const stage = (status: unknown, metadata: Record<string, unknown> | null): LeadStage => {
  const p = lower(metadata?.pipeline_stage);
  if (p === "new" || p === "qualified" || p === "quote_sent" || p === "negotiation" || p === "won" || p === "lost") return p;
  const x = lower(status);
  if (x === "qualified") return "qualified";
  if (x === "quotation_sent" || x === "quote_sent" || x === "sent") return "quote_sent";
  if (x === "negotiation") return "negotiation";
  if (x === "won") return "won";
  if (x === "lost" || x === "archived") return "lost";
  return "new";
};

async function safeSelect<T>(db: SupabaseRestClient, table: string, query: URLSearchParams): Promise<T[]> {
  try { return await db.selectMany<T>(table, query); } catch { return []; }
}
async function sumRevenue(db: SupabaseRestClient, startUtc: string, endUtc: string): Promise<number> {
  const rows = await safeSelect<PaymentRow>(db, "payments", new URLSearchParams({ select: "amount,created_at", status: "in.(paid,captured)", and: `(created_at.gte.${startUtc},created_at.lte.${endUtc})`, limit: "5000" }));
  const start = new Date(startUtc).getTime();
  const end = new Date(endUtc).getTime();
  return round(rows.reduce((acc, row) => {
    const ts = t(row.created_at); const amount = n(row.amount);
    return ts !== null && amount !== null && ts >= start && ts <= end ? acc + amount : acc;
  }, 0));
}
async function missingDocs(db: SupabaseRestClient): Promise<number> {
  const tries: Array<[string, string]> = [
    ["documents", "public_url,status,storage_path"],
    ["documents", "url,status,storage_path"],
    ["booking_documents", "url,status,file_path"],
    ["booking_documents", "file_url,status,file_path"],
  ];
  for (const [table, select] of tries) {
    const rows = await safeSelect<DocRow>(db, table, new URLSearchParams({ select, limit: "2000" }));
    if (!rows.length) continue;
    return rows.filter((row) => {
      const hasUrl = Boolean(s(row.public_url) || s(row.url) || s(row.file_url));
      const hasFile = Boolean(s(row.storage_path) || s(row.file_path));
      const status = lower(row.status);
      return !hasUrl || !hasFile || status === "pending" || status === "failed";
    }).length;
  }
  return 0;
}
async function failedAuto24h(db: SupabaseRestClient): Promise<number> {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const a = await safeSelect<{ id?: string }>(db, "automation_failures", new URLSearchParams({ select: "id", status: "eq.failed", created_at: `gte.${since}`, limit: "5000" }));
  const b = await safeSelect<{ id?: string }>(db, "event_failures", new URLSearchParams({ select: "id", status: "eq.failed", created_at: `gte.${since}`, limit: "5000" }));
  return a.length + b.length;
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;
  try {
    const db = new SupabaseRestClient();
    const now = new Date();
    const day = dayWindow(now);
    const month = monthWindow(now);
    const since30 = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const since90 = new Date(Date.now() - 90 * DAY_MS).toISOString();
    const since7 = new Date(new Date(day.startUtc).getTime() - 6 * DAY_MS).toISOString();
    const [revenueToday, revenueMonth, paymentsPendingRows, quotesTodayRows, openSupport, failedAutomations, missingDocuments, leads30, leads7, bookings, quotes, paidPayments, revenue7, leadNotes, logs] = await Promise.all([
      sumRevenue(db, day.startUtc, day.endUtc),
      sumRevenue(db, month.startUtc, month.endUtc),
      safeSelect<{ id?: string }>(db, "payments", new URLSearchParams({ select: "id", status: "in.(pending,created,requires_action,authorized)", limit: "5000" })),
      safeSelect<QuoteRow>(db, "quotations", new URLSearchParams({ select: "id", status: "in.(sent,quotation_sent,approved)", and: `(created_at.gte.${day.startUtc},created_at.lte.${day.endUtc})`, limit: "2000" })),
      countOpenSupportRequestsLast30Days(),
      failedAuto24h(db),
      missingDocs(db),
      safeSelect<LeadRow>(db, "leads", new URLSearchParams({ select: "id,lead_code,status,metadata,created_at,updated_at", created_at: `gte.${since30}`, order: "created_at.desc", limit: "5000" })),
      safeSelect<LeadRow>(db, "leads", new URLSearchParams({ select: "created_at", created_at: `gte.${since7}`, limit: "5000" })),
      safeSelect<BookingRow>(db, "bookings", new URLSearchParams({ select: "id,booking_code,payment_status,gross_amount,paid_amount,due_amount,created_at,updated_at", order: "created_at.desc", limit: "5000" })),
      safeSelect<QuoteRow>(db, "quotations", new URLSearchParams({ select: "lead_id,created_at", created_at: `gte.${since90}`, limit: "5000" })),
      safeSelect<PaymentRow>(db, "payments", new URLSearchParams({ select: "booking_id,created_at,amount", status: "in.(paid,captured)", created_at: `gte.${since90}`, limit: "5000" })),
      safeSelect<PaymentRow>(db, "payments", new URLSearchParams({ select: "created_at,amount", status: "in.(paid,captured)", created_at: `gte.${since7}`, limit: "5000" })),
      safeSelect<LeadNoteRow>(db, "lead_notes", new URLSearchParams({ select: "lead_id,created_at", created_at: `gte.${since30}`, limit: "5000" })),
      safeSelect<LogRow>(db, "system_logs", new URLSearchParams({ select: "entity_type,entity_id,event,created_at,meta,metadata", created_at: `gte.${since30}`, limit: "5000" })),
    ]);

    const stageCounts: Record<LeadStage, number> = { new: 0, qualified: 0, quote_sent: 0, negotiation: 0, won: 0, lost: 0 };
    const leadIds = new Map<string, string>();
    let leadsToday = 0;
    const dayStart = new Date(day.startUtc).getTime();
    const dayEnd = new Date(day.endUtc).getTime();
    for (const lead of leads30) {
      const st = stage(lead.status, o(lead.metadata)); stageCounts[st] += 1;
      const id = s(lead.id); const code = s(lead.lead_code); const canonical = id || code; if (canonical) { if (id) leadIds.set(id, canonical); if (code) leadIds.set(code, canonical); }
      const c = t(lead.created_at); if (c !== null && c >= dayStart && c <= dayEnd) leadsToday += 1;
    }
    const conversionRate30d = round(pct(stageCounts.won, leads30.length));
    const avgBookingValue = round(avg(bookings.map((b) => n(b.gross_amount)).filter((v): v is number => v !== null && v > 0)) ?? 0);
    let pendingRevenue = 0; let pendingPaymentsOver6h = 0;
    for (const b of bookings) {
      const due = n(b.due_amount); const gross = n(b.gross_amount); const paid = n(b.paid_amount); const status = lower(b.payment_status);
      const pending = due !== null && due > 0 ? due : gross !== null && paid !== null ? Math.max(0, gross - paid) : (status.includes("pending") || status.includes("partial") || status === "authorized") && gross !== null ? gross : 0;
      if (pending > 0) pendingRevenue += pending;
      const ref = t(b.updated_at) ?? t(b.created_at); if (ref !== null && (status.includes("pending") || status.includes("partial") || status === "authorized") && Date.now() - ref > 6 * HOUR_MS) pendingPaymentsOver6h += 1;
    }
    pendingRevenue = round(pendingRevenue);

    const activity = new Map<string, { first: number | null; last: number | null }>();
    for (const v of leadIds.values()) activity.set(v, { first: null, last: null });
    const addActivity = (k: string, tsValue: number | null) => {
      if (!k || tsValue === null) return; const cur = activity.get(k); if (!cur) return;
      activity.set(k, { first: cur.first === null ? tsValue : Math.min(cur.first, tsValue), last: cur.last === null ? tsValue : Math.max(cur.last, tsValue) });
    };
    for (const note of leadNotes) { const c = leadIds.get(s(note.lead_id)); if (c) addActivity(c, t(note.created_at)); }
    for (const log of logs) {
      const event = lower(log.event); if (event === "lead_intake" || event === "lead_created" || event === "crm_lead_created") continue;
      const meta = o(log.meta) ?? o(log.metadata); const ref = s(log.entity_id) || s(meta?.entity_id) || s(meta?.lead_id);
      const c = leadIds.get(ref); if (!c) continue; if (s(log.entity_type) && lower(log.entity_type) !== "lead") continue; addActivity(c, t(log.created_at));
    }

    const leadResp: number[] = []; let leadsNeedFollowup = 0;
    for (const lead of leads30) {
      const st = stage(lead.status, o(lead.metadata)); const created = t(lead.created_at); if (created === null) continue;
      const canonical = s(lead.id) || s(lead.lead_code); const a = canonical ? activity.get(canonical) : null;
      const m = o(lead.metadata); const lastOutreach = t(m?.last_outreach_at); const last = a?.last ?? lastOutreach ?? created;
      if (st !== "won" && st !== "lost" && Date.now() - last > 24 * HOUR_MS) leadsNeedFollowup += 1;
      const firstContact = a?.first;
      if (firstContact !== null && firstContact !== undefined && firstContact >= created) {
        leadResp.push((firstContact - created) / HOUR_MS);
      }
    }

    const quoteByLead = new Map<string, number>();
    for (const q of quotes) { const leadId = s(q.lead_id); const created = t(q.created_at); if (!leadId || created === null) continue; const cur = quoteByLead.get(leadId); if (cur === undefined || created < cur) quoteByLead.set(leadId, created); }
    const quoteTurn: number[] = [];
    for (const lead of leads30) { const id = s(lead.id); const created = t(lead.created_at); const q = quoteByLead.get(id); if (id && created !== null && q !== undefined && q >= created) quoteTurn.push((q - created) / HOUR_MS); }

    const bookingCreated = new Map<string, number>();
    for (const b of bookings) { const created = t(b.created_at); if (created === null) continue; const id = s(b.id); const code = s(b.booking_code); if (id) bookingCreated.set(id, created); if (code) bookingCreated.set(code, created); }
    const paidByBooking = new Map<string, number>();
    for (const p of paidPayments) { const key = s(p.booking_id); const created = t(p.created_at); if (!key || created === null) continue; const cur = paidByBooking.get(key); if (cur === undefined || created < cur) paidByBooking.set(key, created); }
    const payTurn: number[] = [];
    for (const b of bookings) { const created = t(b.created_at); if (created === null) continue; const id = s(b.id); const code = s(b.booking_code); const paid = [id ? paidByBooking.get(id) : undefined, code ? paidByBooking.get(code) : undefined].filter((x): x is number => typeof x === "number"); if (paid.length) { const min = Math.min(...paid); if (min >= created) payTurn.push((min - created) / HOUR_MS); } }

    const leadsSeries = Array.from({ length: 7 }).map((_, i) => {
      const dt = new Date(new Date(day.endUtc).getTime() - (6 - i) * DAY_MS);
      const iso = dt.toISOString();
      return { date: dateKey(iso), label: dateLabel(iso), value: 0 };
    });
    const leadsSeriesIdx = new Map(leadsSeries.map((x, i) => [x.date, i]));
    for (const lead of leads7) { const created = s(lead.created_at); if (!created) continue; const i = leadsSeriesIdx.get(dateKey(created)); if (i !== undefined) leadsSeries[i].value += 1; }
    const revenueSeries = leadsSeries.map((x) => ({ ...x, value: 0 }));
    const revenueSeriesIdx = new Map(revenueSeries.map((x, i) => [x.date, i]));
    for (const p of revenue7) { const created = s(p.created_at); const amount = n(p.amount); if (!created || amount === null) continue; const i = revenueSeriesIdx.get(dateKey(created)); if (i !== undefined) revenueSeries[i].value = round(revenueSeries[i].value + amount); }

    const alerts = [
      leadsNeedFollowup > 0 ? { key: "leads_followup", severity: (leadsNeedFollowup > 15 ? "error" : "warn") as Severity, message: "Leads need follow-up (>24h no contact)", count: leadsNeedFollowup, href: "/admin/crm/leads?stage=new" } : null,
      pendingPaymentsOver6h > 0 ? { key: "payments_followup", severity: (pendingPaymentsOver6h > 8 ? "error" : "warn") as Severity, message: "Pending payments older than 6 hours", count: pendingPaymentsOver6h, href: "/admin/bookings?payment_status=pending" } : null,
      missingDocuments > 0 ? { key: "missing_documents", severity: "warn" as Severity, message: "Missing/pending documents", count: missingDocuments, href: "/admin/documents?missing_only=1" } : null,
      failedAutomations > 0 ? { key: "failed_automations", severity: "error" as Severity, message: "Failed automations (24h)", count: failedAutomations, href: "/admin/automation/failures?status=failed&since_hours=24" } : null,
      openSupport > 0 ? { key: "open_support", severity: "warn" as Severity, message: "Open support tickets", count: openSupport, href: "/admin/support-requests?status=open" } : null,
    ].filter((x): x is NonNullable<typeof x> => Boolean(x));

    const dailyTasks = [
      leadsNeedFollowup > 0 ? { key: "task_call_leads", title: `Call ${Math.min(leadsNeedFollowup, 5)} new leads`, detail: `${leadsNeedFollowup} leads waiting for first contact`, href: "/admin/crm/leads?stage=new", priority: "high" as Priority } : null,
      pendingPaymentsOver6h > 0 ? { key: "task_payments", title: `${pendingPaymentsOver6h} payments pending follow-up`, detail: "Follow up with payment-link customers", href: "/admin/bookings?payment_status=pending", priority: "high" as Priority } : null,
      missingDocuments > 0 ? { key: "task_documents", title: `${missingDocuments} bookings missing documents`, detail: "Generate voucher/invoice files", href: "/admin/documents?missing_only=1", priority: "medium" as Priority } : null,
      failedAutomations > 0 ? { key: "task_automations", title: `Review ${failedAutomations} failed automations`, detail: "Retry or resolve failed jobs", href: "/admin/automation/failures?status=failed&since_hours=24", priority: "medium" as Priority } : null,
      openSupport > 0 ? { key: "task_support", title: `Respond to ${openSupport} support tickets`, detail: "Close open support queue", href: "/admin/support-requests?status=open", priority: "medium" as Priority } : null,
    ].filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (!dailyTasks.length) dailyTasks.push({ key: "task_monitor", title: "No critical tasks right now", detail: "Monitor incoming leads and payments", href: "/admin/control-center", priority: "low" });

    return NextResponse.json({
      kpis: { revenueToday, revenueMonth, conversionRate30d: round(conversionRate30d), avgBookingValue, pendingRevenue, leadsToday, quotesSentToday: quotesTodayRows.length, paymentsPending: paymentsPendingRows.length },
      funnel: {
        windowDays: 30,
        counts: { new: stageCounts.new, qualified: stageCounts.qualified, quote_sent: stageCounts.quote_sent, negotiation: stageCounts.negotiation, won: stageCounts.won },
        conversions: {
          newToQualified: round(pct(stageCounts.qualified, stageCounts.new)),
          qualifiedToQuoteSent: round(pct(stageCounts.quote_sent, stageCounts.qualified)),
          quoteSentToNegotiation: round(pct(stageCounts.negotiation, stageCounts.quote_sent)),
          negotiationToWon: round(pct(stageCounts.won, stageCounts.negotiation)),
          overall: round(pct(stageCounts.won, Math.max(stageCounts.new, leads30.length))),
        },
      },
      alerts,
      dailyTasks,
      trends: { leads7d: leadsSeries, revenue7d: revenueSeries },
      performance: {
        avgLeadResponseHours: avg(leadResp) === null ? null : round(avg(leadResp) ?? 0),
        avgQuoteTurnaroundHours: avg(quoteTurn) === null ? null : round(avg(quoteTurn) ?? 0),
        avgPaymentCompletionHours: avg(payTurn) === null ? null : round(avg(payTurn) ?? 0),
      },
      meta: { generatedAt: new Date().toISOString(), timezone: "Asia/Kolkata" as const },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ ...EMPTY, meta: { generatedAt: new Date().toISOString(), timezone: "Asia/Kolkata" as const } });
    }
    return routeError(500, "Failed to load business dashboard metrics");
  }
}
