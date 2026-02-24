"use client";

import { FormEvent, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

export default function BuildPackagePage() {
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    destination: "",
    travel_start_date: "",
    travel_end_date: "",
    adults: 2,
    children: 0,
    budget_min: 0,
    budget_max: 0,
    currency: "INR",
    needs_flights: true,
    needs_stays: true,
    needs_activities: true,
    needs_transfers: true,
    needs_visa: false,
    notes: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/custom-package-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { request?: { id?: string }; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to submit request");
      setMessage(`Request submitted successfully. Ref: ${data.request?.id ?? "generated"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Build Your Package</h1>
          <p className="mt-3 text-slate-200">Tell us your requirements and we will create a personalized itinerary with best rates.</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 grid gap-4 md:grid-cols-2">
          <input required placeholder="Full Name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="h-12 rounded-xl border border-slate-300 px-3" />
          <input required type="email" placeholder="Email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="h-12 rounded-xl border border-slate-300 px-3" />
          <input required placeholder="Phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="h-12 rounded-xl border border-slate-300 px-3" />
          <input required placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="h-12 rounded-xl border border-slate-300 px-3" />
          <input type="date" lang="en-GB" value={form.travel_start_date} onChange={(e) => setForm({ ...form, travel_start_date: e.target.value })} className="h-12 rounded-xl border border-slate-300 px-3" />
          <input type="date" lang="en-GB" value={form.travel_end_date} onChange={(e) => setForm({ ...form, travel_end_date: e.target.value })} className="h-12 rounded-xl border border-slate-300 px-3" />
          <input type="number" min={1} value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })} className="h-12 rounded-xl border border-slate-300 px-3" placeholder="Adults" />
          <input type="number" min={0} value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) })} className="h-12 rounded-xl border border-slate-300 px-3" placeholder="Children" />
          <input type="number" min={0} value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: Number(e.target.value) })} className="h-12 rounded-xl border border-slate-300 px-3" placeholder="Min Budget" />
          <input type="number" min={0} value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: Number(e.target.value) })} className="h-12 rounded-xl border border-slate-300 px-3" placeholder="Max Budget" />

          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.needs_flights} onChange={(e) => setForm({ ...form, needs_flights: e.target.checked })} /> Flights</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.needs_stays} onChange={(e) => setForm({ ...form, needs_stays: e.target.checked })} /> Stays</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.needs_activities} onChange={(e) => setForm({ ...form, needs_activities: e.target.checked })} /> Attractions</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.needs_transfers} onChange={(e) => setForm({ ...form, needs_transfers: e.target.checked })} /> Transfers</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.needs_visa} onChange={(e) => setForm({ ...form, needs_visa: e.target.checked })} /> Visa</label>
          </div>

          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Tell us trip style, hotel preference, special requests" rows={4} className="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2" />

          <button type="submit" disabled={busy} className="md:col-span-2 h-12 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Submit Custom Request
          </button>

          {error ? <p className="md:col-span-2 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="md:col-span-2 text-sm text-green-700">{message}</p> : null}
        </form>
      </section>
    </main>
  );
}
