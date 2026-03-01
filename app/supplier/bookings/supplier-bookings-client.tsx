"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface SupplierBookingRow {
  booking_id?: string | null;
  booking_uuid?: string | null;
  status?: string | null;
  payment_status?: string | null;
  supplier_status?: string | null;
  assignment_status?: string | null;
  created_at?: string | null;
  due_at?: string | null;
  service_type?: string | null;
  service_types?: string[];
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
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

function StatusBadge({ value }: { value?: string | null }) {
  const label = safeString(value).replaceAll("_", " ") || "-";
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
      {label}
    </span>
  );
}

export default function SupplierBookingsClient() {
  const [rows, setRows] = useState<SupplierBookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [q, setQ] = useState("");

  const [applied, setApplied] = useState({
    status: "all",
    serviceType: "all",
    fromDate: "",
    toDate: "",
    q: "",
  });

  const [page, setPage] = useState(0);
  const limit = 25;

  const loadRows = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(page * limit));
        if (applied.status && applied.status !== "all") params.set("status", applied.status);
        if (applied.serviceType && applied.serviceType !== "all") {
          params.set("service_type", applied.serviceType);
        }
        if (applied.fromDate) params.set("from", applied.fromDate);
        if (applied.toDate) params.set("to", applied.toDate);
        if (applied.q) params.set("q", applied.q);

        const response = await fetch(`/api/supplier/bookings?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { rows?: SupplierBookingRow[]; total?: number; error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load bookings (${response.status})`);
        }

        setRows(Array.isArray(payload?.rows) ? payload!.rows : []);
        setTotal(Number(payload?.total ?? 0));
      } catch (err) {
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load supplier bookings");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applied, page]
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  function applyFilters() {
    setApplied({
      status,
      serviceType,
      fromDate,
      toDate,
      q: q.trim(),
    });
    setPage(0);
  }

  function clearFilters() {
    setStatus("all");
    setServiceType("all");
    setFromDate("");
    setToDate("");
    setQ("");
    setApplied({
      status: "all",
      serviceType: "all",
      fromDate: "",
      toDate: "",
      q: "",
    });
    setPage(0);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Assigned Bookings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirm, complete, and track services assigned to your supplier account.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="issue">Issue reported</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">Service type</span>
            <select
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="hotel">Hotel</option>
              <option value="transfer">Transfer</option>
              <option value="activity">Activity</option>
              <option value="flight">Flight</option>
              <option value="ground">Ground service</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-sm xl:col-span-2">
            <span className="text-slate-600">Search</span>
            <input
              type="text"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Booking ID / customer / phone"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#148bc7]"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void loadRows({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">Failed to load bookings</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No assigned bookings found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Booking</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Service</th>
                  <th className="px-3 py-3 font-semibold">Supplier</th>
                  <th className="px-3 py-3 font-semibold">Due</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const bookingRef = safeString(row.booking_id) || `booking-${index}`;
                  return (
                    <tr key={`${bookingRef}-${index}`} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{bookingRef}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <p>{safeString(row.customer_name) || "-"}</p>
                        <p className="text-xs text-slate-500">{safeString(row.customer_phone) || safeString(row.customer_email) || "-"}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {safeString(row.service_type) ||
                          (Array.isArray(row.service_types) && row.service_types.length > 0
                            ? row.service_types.join(", ")
                            : "-")}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge value={row.assignment_status || row.supplier_status} />
                          <StatusBadge value={row.status} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDate(row.due_at || row.created_at)}</td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/supplier/bookings/${encodeURIComponent(bookingRef)}`}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-600">
          Showing <span className="font-medium text-slate-900">{rows.length}</span> of{" "}
          <span className="font-medium text-slate-900">{total}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={!canPrev || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={!canNext || loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

