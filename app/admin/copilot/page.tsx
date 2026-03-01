"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bot,
  Copy,
  Loader2,
  PlayCircle,
  RefreshCw,
  Send,
} from "lucide-react";

type SuggestedActionType =
  | "open_booking"
  | "open_lead"
  | "open_payments_filtered"
  | "run_smoke_tests"
  | "regenerate_documents"
  | "create_followup_note"
  | "draft_customer_reply";

interface SuggestedAction {
  type: SuggestedActionType;
  label: string;
  payload?: Record<string, unknown>;
}

interface CopilotChatResponse {
  reply: string;
  suggestedActions: SuggestedAction[];
  source?: "openai" | "fallback";
  requestId?: string;
  contextSummary?: {
    metrics?: {
      revenueToday?: number;
      pendingPayments?: number;
      missingDocuments?: number;
      openSupportRequests?: number;
      failedAutomations24h?: number;
      retryingAutomations?: number;
    };
  };
  error?: string;
}

interface ControlCenterResponse {
  revenueToday?: number;
  pendingPayments?: number;
  missingDocuments?: number;
  openSupportRequests?: number;
  failedAutomations24h?: number;
  retryingAutomations?: number;
  alerts?: Array<{ severity?: string; message?: string }>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: SuggestedAction[];
  source?: "openai" | "fallback";
  requestId?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatCurrency(value: number | undefined): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default function AdminCopilotPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask me about today’s operations, stuck payments, risky bookings, or support load.",
      actions: [
        { type: "run_smoke_tests", label: "Run smoke tests", payload: {} },
        { type: "open_payments_filtered", label: "Open pending payments", payload: { status: "pending" } },
      ],
      source: "fallback",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [controlCenter, setControlCenter] = useState<ControlCenterResponse | null>(null);
  const [controlLoading, setControlLoading] = useState(true);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant") ?? null,
    [messages]
  );
  const latestActions = latestAssistant?.actions ?? [];

  async function loadControlCenter() {
    setControlLoading(true);
    try {
      const response = await fetch("/api/admin/control-center", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as ControlCenterResponse;
      if (!response.ok) throw new Error("Failed to load control center context.");
      setControlCenter(payload);
    } catch {
      setControlCenter(null);
    } finally {
      setControlLoading(false);
    }
  }

  useEffect(() => {
    void loadControlCenter();
  }, []);

  async function sendMessage(raw: string) {
    const message = safeString(raw);
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setLastPrompt(message);
    setActionNotice(null);
    setActionError(null);

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: message,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const response = await fetch("/api/admin/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: { page: "/admin/copilot" },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as CopilotChatResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Copilot request failed (${response.status})`);
      }
      const assistantMessage: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: safeString(payload.reply) || "I could not generate a response. Please retry.",
        actions: Array.isArray(payload.suggestedActions) ? payload.suggestedActions : [],
        source: payload.source,
        requestId: payload.requestId,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const summaryMetrics = payload.contextSummary?.metrics;
      if (summaryMetrics) {
        setControlCenter((prev) => ({
          ...(prev ?? {}),
          revenueToday: summaryMetrics.revenueToday,
          pendingPayments: summaryMetrics.pendingPayments,
          missingDocuments: summaryMetrics.missingDocuments,
          openSupportRequests: summaryMetrics.openSupportRequests,
          failedAutomations24h: summaryMetrics.failedAutomations24h,
          retryingAutomations: summaryMetrics.retryingAutomations,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: "Copilot is unavailable right now. Retry or run smoke tests for immediate diagnostics.",
          actions: [{ type: "run_smoke_tests", label: "Run smoke tests", payload: {} }],
          source: "fallback",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setActionNotice("Copied to clipboard.");
      setTimeout(() => setActionNotice(null), 1200);
    } catch {
      setActionError("Copy failed.");
      setTimeout(() => setActionError(null), 1200);
    }
  }

  async function executeAction(action: SuggestedAction) {
    const confirmed = window.confirm(`Confirm action: ${action.label}?`);
    if (!confirmed) return;

    setActionBusy(true);
    setActionNotice(null);
    setActionError(null);

    try {
      const payload = toRecord(action.payload);

      if (action.type === "open_booking") {
        const bookingId = safeString(payload.booking_id);
        if (!bookingId) throw new Error("Missing booking_id in action payload.");
        router.push(`/admin/bookings/${encodeURIComponent(bookingId)}`);
        setActionNotice("Opening booking detail.");
        return;
      }

      if (action.type === "open_lead") {
        const leadId = safeString(payload.lead_id);
        if (!leadId) throw new Error("Missing lead_id in action payload.");
        router.push(`/admin/crm/leads/${encodeURIComponent(leadId)}`);
        setActionNotice("Opening lead detail.");
        return;
      }

      if (action.type === "open_payments_filtered") {
        const status = safeString(payload.status) || "pending";
        const day = safeString(payload.day);
        const bookingId = safeString(payload.booking_id);
        const params = new URLSearchParams({ status });
        if (day === "today") params.set("day", "today");
        if (bookingId) params.set("booking_id", bookingId);
        router.push(`/admin/payments?${params.toString()}`);
        setActionNotice("Opening payments list.");
        return;
      }

      if (action.type === "run_smoke_tests") {
        const response = await fetch("/api/admin/ops/run-smoke-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        });
        const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Failed to run smoke tests.");
        }
        setActionNotice(result.message || "Smoke tests triggered.");
        return;
      }

      if (action.type === "regenerate_documents") {
        const bookingId = safeString(payload.booking_id);
        if (!bookingId) throw new Error("Missing booking_id for regenerate documents action.");
        const response = await fetch("/api/admin/ops/regenerate-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true, booking_id: bookingId }),
        });
        const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Failed to regenerate documents.");
        }
        setActionNotice(result.message || `Documents regeneration triggered for ${bookingId}.`);
        return;
      }

      if (action.type === "create_followup_note") {
        const draft = safeString(payload.draft);
        if (!draft) throw new Error("No draft note in action payload.");
        setDraftText(draft);
        await copyText(draft);
        return;
      }

      if (action.type === "draft_customer_reply") {
        const draft = safeString(payload.draft);
        if (!draft) throw new Error("No draft customer reply in action payload.");
        setDraftText(draft);
        await copyText(draft);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Yono DMC Operations Copilot</h2>
          <p className="text-sm text-slate-500">
            Internal assistant for triage, summaries, and suggested next actions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadControlCenter()}
          disabled={controlLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          {controlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Context
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.75fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Copilot Chat</p>
          </div>

          <div className="max-h-[58vh] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border px-3 py-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto max-w-[88%] border-sky-200 bg-sky-50 text-sky-900"
                    : "mr-auto max-w-[95%] border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium uppercase tracking-[0.08em] text-slate-500">
                    {message.role === "user" ? "You" : "Copilot"}
                  </span>
                  {message.role === "assistant" ? (
                    <button
                      type="button"
                      onClick={() => void copyText(message.text)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                {message.role === "assistant" && message.requestId ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    requestId: {message.requestId} | source: {message.source || "-"}
                  </p>
                ) : null}
              </div>
            ))}
            {sending ? (
              <div className="mr-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Copilot is thinking...
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 px-4 py-4">
            {error ? (
              <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask: Which bookings need attention today?"
                rows={3}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              />
              <button
                type="button"
                onClick={() => void sendMessage(input)}
                disabled={sending || !safeString(input)}
                className="inline-flex h-fit items-center gap-2 rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void sendMessage(lastPrompt)}
                disabled={sending || !lastPrompt}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry last prompt
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#199ce0]" />
              <h3 className="text-sm font-semibold text-slate-900">Suggested Actions</h3>
            </div>
            {latestActions.length === 0 ? (
              <p className="text-sm text-slate-500">No actions suggested yet.</p>
            ) : (
              <div className="space-y-2">
                {latestActions.map((action, index) => (
                  <button
                    key={`${action.type}-${index}`}
                    type="button"
                    onClick={() => void executeAction(action)}
                    disabled={actionBusy}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:bg-white disabled:opacity-60"
                  >
                    <span>{action.label}</span>
                    <PlayCircle className="h-4 w-4 text-slate-500" />
                  </button>
                ))}
              </div>
            )}
            {actionNotice ? (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {actionNotice}
              </p>
            ) : null}
            {actionError ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {actionError}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Context Cards</h3>
            {controlLoading ? (
              <div className="space-y-2">
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Revenue Today</p>
                  <p className="font-semibold text-slate-900">{formatCurrency(controlCenter?.revenueToday)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Pending Payments</p>
                  <p className="font-semibold text-slate-900">{controlCenter?.pendingPayments ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Missing Documents</p>
                  <p className="font-semibold text-slate-900">{controlCenter?.missingDocuments ?? 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Failed Automations (24h)</p>
                  <p className="font-semibold text-slate-900">{controlCenter?.failedAutomations24h ?? 0}</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Draft Workspace</h3>
            <p className="mb-2 text-xs text-slate-500">
              Copilot can draft follow-up notes and customer replies. Review before using.
            </p>
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={6}
              placeholder="Draft text appears here..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyText(draftText)}
                disabled={!safeString(draftText)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 disabled:opacity-60"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy draft
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
              <p>Copilot is read-only. It never performs database mutations directly.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
