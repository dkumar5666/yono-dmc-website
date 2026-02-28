import Link from "next/link";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import type { SupplierSignupRequestRow } from "@/lib/supplierSignup/store";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return safeString(value[0]);
  return safeString(value);
}

function formatDateTime(value?: string | null): string {
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

function statusClass(status: string): string {
  const value = status.toLowerCase();
  if (value === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "verified") return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

async function loadRows(filters: {
  status: string;
  businessType: string;
  q: string;
}): Promise<SupplierSignupRequestRow[]> {
  try {
    const db = new SupabaseRestClient();
    const query = new URLSearchParams({
      select:
        "id,status,business_type,company_legal_name,contact_name,contact_email,contact_phone,email_verified,phone_verified,created_at,updated_at",
      order: "created_at.desc",
      limit: "200",
    });
    if (filters.status) query.set("status", `eq.${filters.status}`);
    if (filters.businessType) query.set("business_type", `eq.${filters.businessType}`);

    const rows = await db.selectMany<SupplierSignupRequestRow>("supplier_signup_requests", query);
    const qValue = filters.q.toLowerCase();
    if (!qValue) return rows;

    return rows.filter((row) => {
      const searchBlob = [
        row.id,
        row.company_legal_name,
        row.contact_name,
        row.contact_email,
        row.contact_phone,
        row.business_type,
      ]
        .map((item) => safeString(item).toLowerCase())
        .join(" ");
      return searchBlob.includes(qValue);
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return [];
    return [];
  }
}

export default async function AdminSupplierSignupRequestsPage(props: PageProps) {
  const searchParams = (await props.searchParams) ?? {};
  const status = firstParam(searchParams.status);
  const businessType = firstParam(searchParams.business_type);
  const q = firstParam(searchParams.q);
  const rows = await loadRows({ status, businessType, q });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Supplier Signup Requests</h2>
        <p className="text-sm text-slate-500">Review and approve supplier onboarding requests.</p>
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Status</label>
          <select
            name="status"
            defaultValue={status || ""}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            Business Type
          </label>
          <input
            name="business_type"
            defaultValue={businessType}
            placeholder="Hotel / Airline..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Company, contact, email, phone..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#199ce0]"
          />
        </div>
        <div className="flex items-end gap-2 lg:col-span-4">
          <button
            type="submit"
            className="rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            Apply
          </button>
          <Link
            href="/admin/suppliers/requests"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Clear
          </Link>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No supplier signup requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Request ID</th>
                  <th className="px-3 py-3 font-semibold">Company</th>
                  <th className="px-3 py-3 font-semibold">Business Type</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-3 py-3 font-semibold">Verification</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-3 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowId = safeString(row.id);
                  const statusText = safeString(row.status) || "pending";
                  return (
                    <tr key={rowId} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{rowId || "-"}</td>
                      <td className="px-3 py-3 text-slate-700">
                        <div className="font-medium">{safeString(row.company_legal_name) || "-"}</div>
                        <div className="text-xs text-slate-500">{safeString(row.contact_name) || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{safeString(row.business_type) || "-"}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <div>{safeString(row.contact_email) || "-"}</div>
                        <div className="text-xs text-slate-500">{safeString(row.contact_phone) || "-"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div className="flex flex-col gap-1">
                          <span className={row.email_verified ? "text-emerald-700" : "text-amber-700"}>
                            Email: {row.email_verified ? "Verified" : "Pending"}
                          </span>
                          <span className={row.phone_verified ? "text-emerald-700" : "text-amber-700"}>
                            Phone: {row.phone_verified ? "Verified" : "Pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(statusText)}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="px-3 py-3 text-right">
                        {rowId ? (
                          <Link
                            href={`/admin/suppliers/requests/${encodeURIComponent(rowId)}`}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300"
                          >
                            Open
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
