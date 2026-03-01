"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw, Upload } from "lucide-react";

interface SupplierInvoiceRow {
  id?: string | null;
  booking_id?: string | null;
  booking_uuid?: string | null;
  type?: string | null;
  name?: string | null;
  status?: string | null;
  url?: string | null;
  created_at?: string | null;
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

export default function SupplierInvoicesClient() {
  const [rows, setRows] = useState<SupplierInvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [uploadBookingId, setUploadBookingId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const limit = 25;

  const loadRows = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          scope: "invoices",
          limit: String(limit),
          offset: String(page * limit),
        });
        if (q.trim()) params.set("q", q.trim());
        if (status !== "all") params.set("status", status);

        const response = await fetch(`/api/supplier/bookings?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { rows?: SupplierInvoiceRow[]; total?: number; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to load invoices (${response.status})`);
        }
        const invoiceRows = Array.isArray(payload?.rows) ? payload!.rows : [];
        const filtered = invoiceRows.filter((row) => {
          const statusValue = safeString(row.status).toLowerCase();
          if (status !== "all" && statusValue !== status.toLowerCase()) return false;
          if (q.trim()) {
            const needle = q.trim().toLowerCase();
            const haystack = [
              safeString(row.booking_id),
              safeString(row.name),
              safeString(row.id),
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(needle)) return false;
          }
          return true;
        });
        setRows(filtered);
        setTotal(Number(payload?.total ?? filtered.length));
      } catch (err) {
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load invoices");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, q, status]
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  async function uploadInvoice() {
    setUploadError(null);
    setUploadNotice(null);

    if (!uploadBookingId.trim()) {
      setUploadError("Booking ID is required");
      return;
    }
    if (!uploadFile) {
      setUploadError("Please choose a file");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("booking_id", uploadBookingId.trim());
      form.set("file", uploadFile);

      const response = await fetch("/api/supplier/documents/upload", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; url?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Upload failed (${response.status})`);
      }

      setUploadNotice("Invoice uploaded successfully.");
      setUploadFile(null);
      setUploadBookingId("");
      await loadRows({ silent: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Supplier Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload supplier invoices and track previous uploads linked to assigned bookings.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Upload Invoice</h2>
        <p className="mt-1 text-xs text-slate-500">Attach invoice PDF/image against an assigned booking.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            value={uploadBookingId}
            onChange={(event) => setUploadBookingId(event.target.value)}
            placeholder="Booking ID"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void uploadInvoice()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </button>
        </div>
        {uploadNotice ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {uploadNotice}
          </p>
        ) : null}
        {uploadError ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {uploadError}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(0);
              }}
              placeholder="Search booking / invoice"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="ready">Ready</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void loadRows({ silent: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-semibold">Failed to load invoices</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No invoices uploaded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Invoice</th>
                  <th className="px-3 py-3 font-semibold">Booking</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.id ?? "invoice"}-${index}`} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-900">{safeString(row.name) || safeString(row.id) || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <Link
                        href={`/supplier/bookings/${encodeURIComponent(safeString(row.booking_id) || "-")}`}
                        className="text-[#199ce0] hover:underline"
                      >
                        {safeString(row.booking_id) || "-"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{safeString(row.status) || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(row.created_at)}</td>
                    <td className="px-3 py-3 text-right">
                      {safeString(row.url) ? (
                        <a
                          href={safeString(row.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">No file</span>
                      )}
                    </td>
                  </tr>
                ))}
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

