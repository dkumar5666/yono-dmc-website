"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type IntakeResponse =
  | { ok: true; lead_id: string; deduped: boolean }
  | { ok: false; error?: string; message?: string };

interface LeadCaptureFormState {
  full_name: string;
  email: string;
  phone: string;
  destination: string;
  travel_start: string;
  travel_end: string;
  pax_adults: string;
  pax_children: string;
  budget_min: string;
  budget_max: string;
  requirements: string;
  company: string;
}

function toNullableNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return Math.floor(parsed);
}

function mapErrorMessage(code?: string): string {
  switch (code) {
    case "destination_required":
      return "Destination is required.";
    case "contact_required":
      return "Please provide at least one contact: phone or email.";
    case "rate_limited":
      return "Too many requests from this network. Please try again in a while.";
    case "spam_rejected":
      return "Request rejected. Please try again.";
    case "supabase_not_configured":
      return "Lead service is temporarily unavailable. Please try again later.";
    default:
      return "Could not submit your request right now. Please try again.";
  }
}

const INITIAL_FORM: LeadCaptureFormState = {
  full_name: "",
  email: "",
  phone: "",
  destination: "",
  travel_start: "",
  travel_end: "",
  pax_adults: "",
  pax_children: "",
  budget_min: "",
  budget_max: "",
  requirements: "",
  company: "",
};

export default function LeadCaptureForm() {
  const [form, setForm] = useState<LeadCaptureFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ leadId: string; deduped: boolean } | null>(null);
  const [utm, setUtm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const next: Record<string, string> = {};
    const mapping: Record<string, string> = {
      utm_source: "source",
      utm_medium: "medium",
      utm_campaign: "campaign",
      utm_term: "term",
      utm_content: "content",
    };

    for (const [param, key] of Object.entries(mapping)) {
      const value = params.get(param)?.trim();
      if (value) next[key] = value;
    }
    setUtm(next);
  }, []);

  const canSubmit = useMemo(() => {
    const hasDestination = form.destination.trim().length > 0;
    const hasContact = form.phone.trim().length > 0 || form.email.trim().length > 0;
    return hasDestination && hasContact && !submitting;
  }, [form.destination, form.email, form.phone, submitting]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.destination.trim()) {
      setError("Destination is required.");
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Please enter phone number or email.");
      return;
    }

    setSubmitting(true);
    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : null;
      const payload = {
        full_name: form.full_name || null,
        email: form.email || null,
        phone: form.phone || null,
        destination: form.destination,
        travel_start: form.travel_start || null,
        travel_end: form.travel_end || null,
        pax_adults: toNullableNumber(form.pax_adults),
        pax_children: toNullableNumber(form.pax_children),
        budget_min: toNullableNumber(form.budget_min),
        budget_max: toNullableNumber(form.budget_max),
        requirements: form.requirements || null,
        source: "website",
        utm: Object.keys(utm).length > 0 ? utm : undefined,
        page_url: pageUrl,
        company: form.company || "",
      };

      const response = await fetch("/api/leads/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as IntakeResponse;

      if (!response.ok || !body.ok) {
        const code = body && "error" in body ? body.error : undefined;
        setError(mapErrorMessage(code));
        return;
      }

      setSuccess({ leadId: body.lead_id, deduped: body.deduped });
      setForm(INITIAL_FORM);
    } catch {
      setError("Could not submit your request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold text-slate-900">Plan My Trip</h2>
        <p className="mt-1 text-sm text-slate-500">
          Share your travel plan and our expert team will call you back with options.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Thanks! Our team will contact you shortly. {success.deduped ? "Your request was already in our system." : ""} Lead ID:{" "}
          <span className="font-semibold">{success.leadId}</span>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Full Name</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.full_name}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="Your name"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Destination *</span>
            <input
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.destination}
              onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))}
              placeholder="Dubai, Singapore, Bali..."
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Phone</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+91 98765 43210"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Email</span>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="you@example.com"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Travel Start</span>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.travel_start}
              onChange={(e) => setForm((prev) => ({ ...prev, travel_start: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Travel End</span>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.travel_end}
              onChange={(e) => setForm((prev) => ({ ...prev, travel_end: e.target.value }))}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Adults</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.pax_adults}
              onChange={(e) => setForm((prev) => ({ ...prev, pax_adults: e.target.value }))}
              placeholder="2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Children</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.pax_children}
              onChange={(e) => setForm((prev) => ({ ...prev, pax_children: e.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Budget Min (INR)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.budget_min}
              onChange={(e) => setForm((prev) => ({ ...prev, budget_min: e.target.value }))}
              placeholder="50000"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Budget Max (INR)</span>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
              value={form.budget_max}
              onChange={(e) => setForm((prev) => ({ ...prev, budget_max: e.target.value }))}
              placeholder="150000"
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Requirements</span>
          <textarea
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
            value={form.requirements}
            onChange={(e) => setForm((prev) => ({ ...prev, requirements: e.target.value }))}
            placeholder="Hotel category, activities, visa support, special requests..."
          />
        </label>

        <div className="hidden" aria-hidden="true">
          <label className="space-y-1">
            <span>Company</span>
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.company}
              onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
              placeholder="Leave blank"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Submitting..." : "Get a Callback"}
        </button>
      </form>
    </section>
  );
}
