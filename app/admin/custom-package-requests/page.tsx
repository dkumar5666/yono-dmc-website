"use client";

import { useCallback, useEffect, useState } from "react";

type RequestItem = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  destination: string;
  adults: number;
  children: number;
  budget_min: number;
  budget_max: number;
  currency: string;
  needs_flights: number;
  needs_stays: number;
  needs_activities: number;
  needs_transfers: number;
  needs_visa: number;
  notes: string;
  status: "new" | "in_progress" | "quoted" | "closed";
  admin_notes: string;
  created_at: string;
};

export default function AdminCustomPackageRequestsPage() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "new" | "in_progress" | "quoted" | "closed"
  >("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<Record<string, RequestItem["status"]>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const auth = await fetch("/api/auth/me");
      if (!auth.ok) {
        window.location.href = "/admin/login";
        return;
      }

      const response = await fetch(
        `/api/admin/custom-package-requests?status=${statusFilter}`
      );
      const data = (await response.json()) as {
        requests?: RequestItem[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Failed to load requests");

      const records = data.requests ?? [];
      setItems(records);

      const nextStatus: Record<string, RequestItem["status"]> = {};
      const nextNotes: Record<string, string> = {};
      for (const item of records) {
        nextStatus[item.id] = item.status;
        nextNotes[item.id] = item.admin_notes ?? "";
      }
      setDraftStatus(nextStatus);
      setDraftNotes(nextNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setBusy(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(itemId: string) {
    try {
      const response = await fetch(`/api/admin/custom-package-requests/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draftStatus[itemId],
          admin_notes: draftNotes[itemId] ?? "",
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to update request");

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request");
    }
  }

  return (
      <section className="max-w-7xl mx-auto">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Custom Package Requests</h2>
          <p className="mt-1 text-sm text-slate-600">
            Customer build-package leads for operations team
          </p>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium">Status</label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "new" | "in_progress" | "quoted" | "closed"
              )
            }
            className="border rounded-lg px-3 py-2"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="quoted">Quoted</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {busy ? <p className="text-slate-600">Loading...</p> : null}
        {error ? <p className="text-red-700 text-sm mb-4">{error}</p> : null}

        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {item.customer_name} - {item.destination}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {item.customer_email} | {item.customer_phone}
                  </p>
                  <p className="text-sm text-slate-600">
                    Pax: {item.adults} Adults, {item.children} Children
                  </p>
                  <p className="text-sm text-slate-600">
                    Budget: {item.currency} {item.budget_min} - {item.budget_max}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString("en-IN")}
                </p>
              </div>

              <p className="mt-3 text-sm text-slate-700">
                {item.notes || "No special notes"}
              </p>

              <div className="mt-3 text-sm text-slate-700 flex flex-wrap gap-3">
                {item.needs_flights ? <span>Flights</span> : null}
                {item.needs_stays ? <span>Stays</span> : null}
                {item.needs_activities ? <span>Attractions</span> : null}
                {item.needs_transfers ? <span>Transfers</span> : null}
                {item.needs_visa ? <span>Visa</span> : null}
              </div>

              <div className="mt-4 grid md:grid-cols-3 gap-3">
                <select
                  value={draftStatus[item.id] ?? item.status}
                  onChange={(e) =>
                    setDraftStatus((prev) => ({
                      ...prev,
                      [item.id]: e.target.value as RequestItem["status"],
                    }))
                  }
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="quoted">Quoted</option>
                  <option value="closed">Closed</option>
                </select>
                <input
                  value={draftNotes[item.id] ?? ""}
                  onChange={(e) =>
                    setDraftNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  placeholder="Admin notes"
                  className="border rounded-lg px-3 py-2 md:col-span-2"
                />
              </div>

              <button
                type="button"
                onClick={() => void updateStatus(item.id)}
                className="mt-3 rounded-lg bg-[#199ce0] text-white px-4 py-2 text-sm font-semibold"
              >
                Save Update
              </button>
            </article>
          ))}

          {!busy && items.length === 0 ? (
            <p className="text-slate-600">No requests found.</p>
          ) : null}
        </div>
      </section>
  );
}
