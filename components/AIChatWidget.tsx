"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";

interface SuggestedAction {
  label: string;
  href: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: SuggestedAction[];
  intent?: string;
}

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const key = "yono_ai_session_id";
      const existing = window.localStorage.getItem(key);
      if (existing) return existing;
      const created =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sess_${Date.now()}`;
      window.localStorage.setItem(key, created);
      return created;
    } catch {
      return `sess_${Date.now()}`;
    }
  });
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I am Yono DMC AI Assistant. Ask me about flights, refunds, packages, stays, trips, and support.",
    },
  ]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !busy,
    [input, busy]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;

    const userMessage = input.trim();
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-8),
          sessionId,
          lead:
            leadSubmitted || leadName || leadEmail || leadPhone
              ? {
                  name: leadName,
                  email: leadEmail,
                  phone: leadPhone,
                }
              : undefined,
        }),
      });

      const data = (await response.json()) as {
        data?: { answer?: string; actions?: SuggestedAction[]; intent?: string };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(data.error?.message ?? "Assistant is currently unavailable.");
      }

      const answer = data.data?.answer ?? "I could not generate a response. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
          actions: data.data?.actions ?? [],
          intent: data.data?.intent ?? "",
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "Assistant is currently unavailable. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function submitLead() {
    if (!leadName.trim() && !leadEmail.trim() && !leadPhone.trim()) return;
    setLeadSubmitted(true);
    setShowLeadForm(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Thanks. I have captured your details. Continue your query and our team can follow up when needed.",
      },
    ]);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[70] inline-flex items-center gap-2 rounded-full bg-[#199ce0] px-4 py-3 text-white shadow-lg hover:opacity-95"
        >
          <MessageCircle className="h-5 w-5" />
          Ask AI
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[70] w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="inline-flex items-center gap-2 font-semibold text-slate-900">
              <Bot className="h-5 w-5 text-[#199ce0]" />
              Yono AI Assistant
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="h-[360px] overflow-y-auto px-3 py-3 space-y-2 bg-slate-50">
            {!leadSubmitted && (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm text-slate-700">
                  Need a callback for booking/change/cancel requests?
                </p>
                <button
                  type="button"
                  onClick={() => setShowLeadForm((prev) => !prev)}
                  className="mt-2 text-sm font-medium text-[#199ce0]"
                >
                  {showLeadForm ? "Hide details form" : "Share contact details"}
                </button>
                {showLeadForm && (
                  <div className="mt-2 space-y-2">
                    <input
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={submitLead}
                      className="rounded-lg bg-[#199ce0] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Save Details
                    </button>
                  </div>
                )}
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === "user"
                    ? "ml-auto bg-[#199ce0] text-white"
                    : "mr-auto bg-white border border-slate-200 text-slate-800"
                }`}
              >
                {message.content}
                {message.role === "assistant" &&
                Array.isArray(message.actions) &&
                message.actions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.actions.map((action) => (
                      <a
                        key={`${action.href}-${action.label}`}
                        href={action.href}
                        className="inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy && (
              <div className="mr-auto max-w-[90%] rounded-xl px-3 py-2 text-sm border border-slate-200 bg-white text-slate-600">
                Thinking...
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about booking, refund, visa..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#199ce0] text-white disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
