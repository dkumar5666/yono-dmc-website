"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, FileText, Loader2, Wallet } from "lucide-react";

interface IdentityView {
  fullName: string | null;
}

interface CountResponse {
  total?: number;
  rows?: unknown[];
  error?: string;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AgentDashboardClient({ identity }: { identity: IdentityView }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openLeads, setOpenLeads] = useState(0);
  const [quotesSent, setQuotesSent] = useState(0);
  const [bookings, setBookings] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [leadsRes, quotesRes, bookingsRes, pendingRes] = await Promise.all([
        fetch("/api/agent/leads?limit=1&offset=0&stage=all", { cache: "no-store" }),
        fetch("/api/agent/quotes?limit=1&offset=0&status=sent", { cache: "no-store" }),
        fetch("/api/agent/bookings?limit=1&offset=0", { cache: "no-store" }),
        fetch("/api/agent/bookings?limit=1&offset=0&payment_status=pending", { cache: "no-store" }),
      ]);

      const [leadsBody, quotesBody, bookingsBody, pendingBody] = (await Promise.all([
        leadsRes.json().catch(() => ({})),
        quotesRes.json().catch(() => ({})),
        bookingsRes.json().catch(() => ({})),
        pendingRes.json().catch(() => ({})),
      ])) as CountResponse[];

      if (!leadsRes.ok || !quotesRes.ok || !bookingsRes.ok || !pendingRes.ok) {
        throw new Error(
          leadsBody.error || quotesBody.error || bookingsBody.error || pendingBody.error || "Failed to load dashboard"
        );
      }

      setOpenLeads(toNumber(leadsBody.total));
      setQuotesSent(toNumber(quotesBody.total));
      setBookings(toNumber(bookingsBody.total));
      setPendingPayments(toNumber(pendingBody.total));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
      setOpenLeads(0);
      setQuotesSent(0);
      setBookings(0);
      setPendingPayments(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const cards = useMemo(
    () => [
      { label: "Leads Open", value: openLeads, href: "/agent/leads", icon: FileText },
      { label: "Quotes Sent", value: quotesSent, href: "/agent/quotes?status=sent", icon: FileText },
      { label: "Bookings", value: bookings, href: "/agent/bookings", icon: Wallet },
      { label: "Pending Payments", value: pendingPayments, href: "/agent/bookings?payment_status=pending", icon: AlertCircle },
    ],
    [openLeads, quotesSent, bookings, pendingPayments]
  );

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#199ce0]">B2B Agent Portal</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Welcome, {identity.fullName || "Agent"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage lead requests, quotations, and bookings from one workspace.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/agent/leads/new"
            className="inline-flex items-center rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#148bc7]"
          >
            Request a Quote
          </Link>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Failed to load agent metrics</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#199ce0]/40"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <Icon className="h-4 w-4 text-[#199ce0]" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : card.value}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
