"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Wrench,
} from "lucide-react";

type ActionResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  error?: string;
  requestId?: string;
  request_id?: string;
  data?: unknown;
  checks?: Array<{ status?: "pass" | "warn" | "fail" }>;
};

type LastAction = {
  action: string;
  ok: boolean;
  code: string;
  message: string;
  requestId: string;
  at: string;
};

type CustomerLookupPayload = {
  query?: string;
  customers?: Array<{
    id?: string | null;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
  }>;
  bookings?: Array<{
    booking_id?: string | null;
    status?: string | null;
    payment_status?: string | null;
    amount?: number | null;
    currency?: string | null;
    created_at?: string | null;
  }>;
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value: string | null | undefined): string {
  const raw = safeString(value);
  if (!raw) return "-";
  const date = new Date(raw);
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

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: safeString(currency) || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseActionResponse(action: string, payload: ActionResponse, fallbackStatusText: string): LastAction {
  const ok = payload.ok === true;
  const code = safeString(payload.code) || (ok ? "ok" : "failed");
  const message =
    safeString(payload.message) ||
    safeString(payload.error) ||
    (ok ? "Action completed." : `Action failed (${fallbackStatusText}).`);
  const requestId = safeString(payload.requestId) || safeString(payload.request_id) || "-";

  return {
    action,
    ok,
    code,
    message,
    requestId,
    at: new Date().toISOString(),
  };
}

export default function AdminOpsToolkitPage() {
  const [bookingId, setBookingId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [providerPaymentId, setProviderPaymentId] = useState("");
  const [providerOrderId, setProviderOrderId] = useState("");
  const [failureId, setFailureId] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [confirmQuickFix, setConfirmQuickFix] = useState(false);
  const [confirmSystem, setConfirmSystem] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [lookupData, setLookupData] = useState<CustomerLookupPayload | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [smokeSummary, setSmokeSummary] = useState<{ pass: number; warn: number; fail: number } | null>(null);

  const canRunQuickFix = useMemo(() => confirmQuickFix, [confirmQuickFix]);
  const canRunSystem = useMemo(() => confirmSystem, [confirmSystem]);

  async function runPostAction(action: string, url: string, body: Record<string, unknown>) {
    setLoadingAction(action);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as ActionResponse;
      const normalized = parseActionResponse(action, payload, String(response.status));
      setLastAction(normalized);
    } catch {
      setLastAction({
        action,
        ok: false,
        code: "network_error",
        message: "Action failed due to network/server error.",
        requestId: "-",
        at: new Date().toISOString(),
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function runSmokeTests() {
    if (!canRunSystem) return;
    setLoadingAction("run-smoke-tests");
    try {
      const response = await fetch("/api/admin/ops/run-smoke-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as ActionResponse;
      const checks = Array.isArray((payload.data as { checks?: unknown[] } | undefined)?.checks)
        ? ((payload.data as { checks: Array<{ status?: "pass" | "warn" | "fail" }> }).checks ?? [])
        : [];
      setSmokeSummary({
        pass: checks.filter((row) => row.status === "pass").length,
        warn: checks.filter((row) => row.status === "warn").length,
        fail: checks.filter((row) => row.status === "fail").length,
      });
      setLastAction(parseActionResponse("run-smoke-tests", payload, String(response.status)));
    } catch {
      setLastAction({
        action: "run-smoke-tests",
        ok: false,
        code: "smoke_tests_unreachable",
        message: "Unable to run smoke tests.",
        requestId: "-",
        at: new Date().toISOString(),
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function runLookup() {
    setLoadingAction("customer-lookup");
    setLookupError(null);
    try {
      const response = await fetch(
        `/api/admin/ops/customer-lookup?q=${encodeURIComponent(lookupQuery)}&limit=20`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as ActionResponse;
      if (!response.ok || payload.ok !== true) {
        setLookupData(null);
        setLookupError(safeString(payload.error) || "Customer lookup failed.");
      } else {
        setLookupData((payload.data as CustomerLookupPayload) ?? null);
      }
      setLastAction(parseActionResponse("customer-lookup", payload, String(response.status)));
    } catch {
      setLookupData(null);
      setLookupError("Customer lookup failed.");
      setLastAction({
        action: "customer-lookup",
        ok: false,
        code: "network_error",
        message: "Customer lookup failed.",
        requestId: "-",
        at: new Date().toISOString(),
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function copyBookingLink(bookingIdValue: string | null | undefined) {
    const ref = safeString(bookingIdValue);
    if (!ref) return;
    const url = `${window.location.origin}/admin/bookings/${encodeURIComponent(ref)}`;
    await navigator.clipboard.writeText(url);
  }

  const customers = lookupData?.customers ?? [];
  const bookings = lookupData?.bookings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Ops Toolkit</h2>
        <p className="text-sm text-slate-500">
          Go-live support actions with audit logging and request tracing.
        </p>
      </div>

      {lastAction ? (
        <section
          className={`rounded-2xl border p-4 shadow-sm ${
            lastAction.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                lastAction.ok
                  ? "border-emerald-200 bg-white text-emerald-600"
                  : "border-rose-200 bg-white text-rose-600"
              }`}
            >
              {lastAction.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            </span>
            <div className="text-sm">
              <p className="font-semibold text-slate-900">{lastAction.action}</p>
              <p className="mt-1 text-slate-700">{lastAction.message}</p>
              <p className="mt-1 text-xs text-slate-600">
                code: {lastAction.code} | requestId: {lastAction.requestId} | at:{" "}
                {formatDateTime(lastAction.at)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">Quick Fix Actions</h3>
        </div>
        <p className="mb-4 text-xs text-slate-500">
          These actions are safe-mode operational tools. Every action is audit logged.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Booking ID / Code</span>
            <input
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="BK-XXXX or booking UUID"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Automation Failure ID</span>
            <input
              value={failureId}
              onChange={(e) => setFailureId(e.target.value)}
              placeholder="Failure UUID"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Payment ID</span>
            <input
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="Payment UUID"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Provider Payment ID</span>
            <input
              value={providerPaymentId}
              onChange={(e) => setProviderPaymentId(e.target.value)}
              placeholder="Razorpay payment id"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Provider Order ID</span>
            <input
              value={providerOrderId}
              onChange={(e) => setProviderOrderId(e.target.value)}
              placeholder="Razorpay order id"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmQuickFix}
            onChange={(e) => setConfirmQuickFix(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#199ce0] focus:ring-[#199ce0]"
          />
          I understand and confirm this action.
        </label>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            disabled={!canRunQuickFix || !bookingId || loadingAction !== null}
            onClick={() =>
              void runPostAction("resend-documents", "/api/admin/ops/resend-documents", {
                booking_id: bookingId,
                confirm: true,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingAction === "resend-documents" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Resend Documents
          </button>
          <button
            type="button"
            disabled={!canRunQuickFix || !bookingId || loadingAction !== null}
            onClick={() =>
              void runPostAction("regenerate-documents", "/api/admin/ops/regenerate-documents", {
                booking_id: bookingId,
                confirm: true,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b79b6] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingAction === "regenerate-documents" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Regenerate Documents
          </button>
          <button
            type="button"
            disabled={!canRunQuickFix || !bookingId || loadingAction !== null}
            onClick={() =>
              void runPostAction("resync-supplier", "/api/admin/ops/resync-supplier", {
                booking_id: bookingId,
                confirm: true,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingAction === "resync-supplier" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Resync Supplier
          </button>
          <button
            type="button"
            disabled={
              !canRunQuickFix ||
              (!paymentId && !providerPaymentId && !providerOrderId) ||
              loadingAction !== null
            }
            onClick={() =>
              void runPostAction("payment-sync", "/api/admin/ops/payment-sync", {
                payment_id: paymentId || null,
                provider_payment_id: providerPaymentId || null,
                provider_order_id: providerOrderId || null,
                confirm: true,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {loadingAction === "payment-sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Re-run Payment Sync
          </button>
          <button
            type="button"
            disabled={!canRunQuickFix || !failureId || loadingAction !== null}
            onClick={() =>
              void runPostAction("resolve-failure", "/api/admin/ops/resolve-failure", {
                failure_id: failureId,
                confirm: true,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {loadingAction === "resolve-failure" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Mark Failure Resolved
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Customer Assistance</h3>
        <p className="mt-1 text-xs text-slate-500">
          Lookup by phone/email and review latest bookings (read-only).
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            placeholder="Email or phone"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
          />
          <button
            type="button"
            disabled={!lookupQuery || loadingAction !== null}
            onClick={() => void runLookup()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingAction === "customer-lookup" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Lookup
          </button>
        </div>
        {lookupError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {lookupError}
          </p>
        ) : null}

        {lookupData ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Matched Customers</p>
              {customers.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No customers found.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((row, idx) => (
                        <tr key={`${row.id || row.email || row.phone || idx}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-800">{safeString(row.full_name) || "-"}</td>
                          <td className="px-3 py-2 text-slate-700">{safeString(row.email) || "-"}</td>
                          <td className="px-3 py-2 text-slate-700">{safeString(row.phone) || "-"}</td>
                          <td className="px-3 py-2 text-slate-600">{safeString(row.source) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Latest Bookings</p>
              {bookings.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No bookings found.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Booking</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Payment</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((row, idx) => (
                        <tr key={`${row.booking_id || idx}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-900">{safeString(row.booking_id) || "-"}</td>
                          <td className="px-3 py-2 text-slate-700">{safeString(row.status) || "-"}</td>
                          <td className="px-3 py-2 text-slate-700">{safeString(row.payment_status) || "-"}</td>
                          <td className="px-3 py-2 text-slate-700">
                            {formatAmount(typeof row.amount === "number" ? row.amount : null, row.currency)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{formatDateTime(row.created_at)}</td>
                          <td className="px-3 py-2">
                            {safeString(row.booking_id) ? (
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/admin/bookings/${encodeURIComponent(safeString(row.booking_id))}`}
                                  className="text-[#199ce0] hover:underline"
                                >
                                  Open
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => void copyBookingLink(row.booking_id)}
                                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                                >
                                  <ClipboardCopy className="h-3.5 w-3.5" />
                                  Copy link
                                </button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Create support request on behalf is intentionally disabled in safe mode.
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">System Actions</h3>
        <p className="mt-1 text-xs text-slate-500">Manual triggers for scheduler and diagnostics.</p>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmSystem}
            onChange={(e) => setConfirmSystem(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#199ce0] focus:ring-[#199ce0]"
          />
          I understand and confirm system trigger actions.
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={!canRunSystem || loadingAction !== null}
            onClick={() =>
              void runPostAction("run-cron-retry", "/api/admin/ops/run-cron-retry", { confirm: true })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {loadingAction === "run-cron-retry" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Trigger Cron Retry
          </button>
          <button
            type="button"
            disabled={!canRunSystem || loadingAction !== null}
            onClick={() => void runPostAction("run-outreach", "/api/admin/ops/run-outreach", { confirm: true })}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {loadingAction === "run-outreach" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Trigger Outreach
          </button>
          <button
            type="button"
            disabled={!canRunSystem || loadingAction !== null}
            onClick={() => void runSmokeTests()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loadingAction === "run-smoke-tests" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Run Smoke Tests
          </button>
        </div>
        {smokeSummary ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Smoke summary: pass {smokeSummary.pass}, warn {smokeSummary.warn}, fail {smokeSummary.fail}
          </div>
        ) : null}
      </section>
    </div>
  );
}
