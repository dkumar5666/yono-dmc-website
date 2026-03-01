"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

function safeString(value: string): string {
  return value.trim();
}

export default function AgentNewLeadClient() {
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    destination: "",
    travel_start_date: "",
    travel_end_date: "",
    pax_adults: "",
    pax_children: "",
    budget: "",
    requirements: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!safeString(form.destination)) {
      setError("Destination is required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/agent/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: safeString(form.customer_name),
          customer_email: safeString(form.customer_email),
          customer_phone: safeString(form.customer_phone),
          destination: safeString(form.destination),
          travel_start_date: form.travel_start_date || null,
          travel_end_date: form.travel_end_date || null,
          pax_adults: form.pax_adults ? Number(form.pax_adults) : null,
          pax_children: form.pax_children ? Number(form.pax_children) : null,
          budget: form.budget ? Number(form.budget) : null,
          requirements: safeString(form.requirements),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        lead?: { id?: string | null; lead_id?: string | null };
        error?: string;
      };
      if (!response.ok || !payload.lead) {
        throw new Error(payload.error || `Failed to create lead (${response.status})`);
      }

      const ref = payload.lead.lead_id || payload.lead.id;
      setSuccess(ref ? `Lead created: ${ref}` : "Lead created successfully.");
      setForm({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        destination: "",
        travel_start_date: "",
        travel_end_date: "",
        pax_adults: "",
        pax_children: "",
        budget: "",
        requirements: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Request a Quote</h1>
            <p className="mt-1 text-sm text-slate-500">Submit customer requirements for the operations team.</p>
          </div>
          <Link
            href="/agent/leads"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Back to Leads
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Failed to submit lead</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Customer Name</span>
            <input
              type="text"
              value={form.customer_name}
              onChange={(event) => setForm((prev) => ({ ...prev, customer_name: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Traveler name"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Email</span>
            <input
              type="email"
              value={form.customer_email}
              onChange={(event) => setForm((prev) => ({ ...prev, customer_email: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="traveler@email.com"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Phone</span>
            <input
              type="tel"
              value={form.customer_phone}
              onChange={(event) => setForm((prev) => ({ ...prev, customer_phone: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="+91 98XXXXXXXX"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Destination *</span>
            <input
              type="text"
              required
              value={form.destination}
              onChange={(event) => setForm((prev) => ({ ...prev, destination: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Dubai, UAE"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Travel Start</span>
            <input
              type="date"
              value={form.travel_start_date}
              onChange={(event) => setForm((prev) => ({ ...prev, travel_start_date: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Travel End</span>
            <input
              type="date"
              value={form.travel_end_date}
              onChange={(event) => setForm((prev) => ({ ...prev, travel_end_date: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Adults</span>
            <input
              type="number"
              min={0}
              value={form.pax_adults}
              onChange={(event) => setForm((prev) => ({ ...prev, pax_adults: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Children</span>
            <input
              type="number"
              min={0}
              value={form.pax_children}
              onChange={(event) => setForm((prev) => ({ ...prev, pax_children: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Budget (INR)</span>
            <input
              type="number"
              min={0}
              value={form.budget}
              onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="150000"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2 xl:col-span-3">
            <span className="text-slate-600">Requirements</span>
            <textarea
              rows={4}
              value={form.requirements}
              onChange={(event) => setForm((prev) => ({ ...prev, requirements: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Hotel preference, meal plan, flight timing, sightseeing expectations..."
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#148bc7] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitting ? "Submitting..." : "Submit Quote Request"}
          </button>
        </div>
      </form>
    </section>
  );
}
