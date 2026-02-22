"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ForgotItineraryPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/trips/forgot-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as {
        data?: { message?: string };
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Failed to send itinerary.");
      }
      setMessage(
        data.data?.message ??
          "If an itinerary exists for this email, details will be sent."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send itinerary.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link
          href="/trips"
          className="inline-flex items-center gap-2 text-[#199ce0] font-medium"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="mt-4 text-5xl font-bold text-slate-900">
          How to find your itinerary number
        </h1>

        <p className="mt-8 text-slate-700 text-lg leading-relaxed">
          Your itinerary number is at the top of the travel confirmation we emailed to you.
          If you can&apos;t locate your itinerary number, we can resend it.
        </p>
        <p className="mt-4 text-slate-700">Asterisk &quot;*&quot; indicates a required field.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address *"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-[#199ce0] px-5 py-3 text-white font-semibold disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send itinerary"}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

