"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface BookingRow {
  id?: string | null;
  booking_id?: string | null;
  lead_id?: string | null;
  quotation_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface LeadRow {
  id?: string | null;
  lead_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  destination?: string | null;
}

interface QuoteRow {
  id?: string | null;
  quotation_id?: string | null;
  quotation_code?: string | null;
  status?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  pdf_url?: string | null;
  summary_url?: string | null;
}

interface PaymentRow {
  id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  provider?: string | null;
  payment_url?: string | null;
  created_at?: string | null;
}

interface DocumentRow {
  id?: string | null;
  type?: string | null;
  name?: string | null;
  status?: string | null;
  url?: string | null;
  created_at?: string | null;
}

interface DetailResponse {
  booking: BookingRow | null;
  lead: LeadRow | null;
  quotations: QuoteRow[];
  payments: PaymentRow[];
  documents: DocumentRow[];
  error?: string;
}

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

function badgeClass(value: string): string {
  const normalized = safeString(value).toLowerCase();
  if (normalized === "paid" || normalized === "captured") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "pending" || normalized === "payment_pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "cancelled" || normalized === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "confirmed") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function AgentBookingDetailClient({ bookingId }: { bookingId: string }) {
  const bookingRef = useMemo(() => safeString(bookingId), [bookingId]);

  const [data, setData] = useState<DetailResponse>({
    booking: null,
    lead: null,
    quotations: [],
    payments: [],
    documents: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!bookingRef) {
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/agent/bookings/${encodeURIComponent(bookingRef)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as DetailResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load booking (${response.status})`);
        }

        setData({
          booking: payload?.booking ?? null,
          lead: payload?.lead ?? null,
          quotations: Array.isArray(payload?.quotations) ? payload!.quotations : [],
          payments: Array.isArray(payload?.payments) ? payload!.payments : [],
          documents: Array.isArray(payload?.documents) ? payload!.documents : [],
        });
      } catch (err) {
        setData({ booking: null, lead: null, quotations: [], payments: [], documents: [] });
        setError(err instanceof Error ? err.message : "Failed to load booking");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingRef]
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const booking = data.booking;
  const lead = data.lead;
  const pageTitle = safeString(booking?.booking_id) || bookingRef;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Booking: {pageTitle || "-"}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(booking?.status || "")}`}>
                {safeString(booking?.status) || "-"}
              </span>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(booking?.payment_status || "")}`}>
                Payment: {safeString(booking?.payment_status) || "-"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/agent/bookings"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Back to Bookings
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
              <p className="font-semibold">Failed to load booking</p>
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
              <p className="text-sm text-slate-500">Amount</p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {formatAmount(booking?.total_amount ?? null, safeString(booking?.currency) || "INR")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Created</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{formatDate(booking?.created_at)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Lead</p>
              {safeString(lead?.lead_id) || safeString(lead?.id) ? (
                <Link
                  href={`/agent/leads/${encodeURIComponent(safeString(lead?.lead_id) || safeString(lead?.id))}`}
                  className="mt-2 inline-flex text-sm font-medium text-[#199ce0] hover:underline"
                >
                  {safeString(lead?.lead_id) || safeString(lead?.id)}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-700">-</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Support</p>
              {(safeString(lead?.lead_id) || safeString(lead?.id)) ? (
                <Link
                  href={`/agent/leads/${encodeURIComponent(safeString(lead?.lead_id) || safeString(lead?.id))}`}
                  className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  Request support follow-up
                </Link>
              ) : (
                <p className="mt-2 text-sm text-slate-700">-</p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
          <div className="mt-3 space-y-2">
            {data.payments.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No payment records found.
              </div>
            ) : (
              data.payments.slice(0, 20).map((payment, index) => (
                <div key={`${payment.id ?? "payment"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{safeString(payment.id) || "Payment"}</p>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(payment.status || "")}`}>
                      {safeString(payment.status) || "-"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{formatAmount(payment.amount ?? null, safeString(payment.currency) || "INR")}</p>
                  <p className="mt-1 text-xs text-slate-500">{safeString(payment.provider) || "provider"} • {formatDate(payment.created_at)}</p>
                  {safeString(payment.payment_url) ? (
                    <a
                      href={safeString(payment.payment_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      Open payment link
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
          <div className="mt-3 space-y-2">
            {data.documents.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Documents will appear here once generated.
              </div>
            ) : (
              data.documents.map((doc, index) => (
                <div key={`${doc.id ?? "doc"}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{safeString(doc.name) || safeString(doc.type) || "Document"}</p>
                    <p className="text-xs text-slate-500">{safeString(doc.status) || "-"} • {formatDate(doc.created_at)}</p>
                  </div>
                  {safeString(doc.url) ? (
                    <a
                      href={safeString(doc.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Pending</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Linked Quotations</h2>
        <div className="mt-3 space-y-2">
          {data.quotations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No quotations linked.
            </div>
          ) : (
            data.quotations.slice(0, 10).map((quote, index) => (
              <div key={`${quote.id ?? quote.quotation_id ?? "quote"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{safeString(quote.quotation_code) || safeString(quote.quotation_id) || "Quote"}</p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(quote.status || "")}`}>
                    {safeString(quote.status) || "-"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{formatAmount(quote.total_amount ?? null, safeString(quote.currency) || "INR")}</p>
                <div className="mt-2 flex gap-2">
                  {safeString(quote.pdf_url) ? (
                    <a href={safeString(quote.pdf_url)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">PDF</a>
                  ) : null}
                  {safeString(quote.summary_url) ? (
                    <a href={safeString(quote.summary_url)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">Summary</a>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

