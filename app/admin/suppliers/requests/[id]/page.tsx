import Link from "next/link";
import SupplierRequestActions from "@/app/admin/suppliers/requests/[id]/request-actions";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { createSupplierSignupDocSignedUrl } from "@/lib/supplierSignup/storageUpload";
import type { SupplierSignupRequestRow } from "@/lib/supplierSignup/store";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function statusClass(status: string): string {
  const value = status.toLowerCase();
  if (value === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "verified") return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
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

async function loadRequest(id: string): Promise<SupplierSignupRequestRow | null> {
  try {
    const db = new SupabaseRestClient();
    const rows = await db.selectMany<SupplierSignupRequestRow>(
      "supplier_signup_requests",
      new URLSearchParams({
        select: "*",
        id: `eq.${id}`,
        limit: "1",
      })
    );
    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

async function buildDocLinks(docs: unknown): Promise<Array<{ type: string; fileName: string; url: string | null }>> {
  const obj = safeObject(docs);
  const output: Array<{ type: string; fileName: string; url: string | null }> = [];

  for (const [type, value] of Object.entries(obj)) {
    const row = safeObject(value);
    const path = safeString(row.path);
    const fileName = safeString(row.file_name) || path.split("/").pop() || type;
    const signedUrl = path ? await createSupplierSignupDocSignedUrl(path, 60 * 60) : null;
    const publicUrl = safeString(row.public_url);
    output.push({
      type,
      fileName,
      url: signedUrl || publicUrl || null,
    });
  }

  output.sort((a, b) => a.type.localeCompare(b.type));
  return output;
}

export default async function AdminSupplierSignupRequestDetailPage(props: PageProps) {
  const resolvedParams = "then" in props.params ? await props.params : props.params;
  const requestId = decodeURIComponent(resolvedParams.id || "").trim();
  const row = requestId ? await loadRequest(requestId) : null;
  const docs = await buildDocLinks(row?.docs);

  if (!requestId || !row) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Supplier Signup Request</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Request not found.
        </div>
        <Link
          href="/admin/suppliers/requests"
          className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          Back to Requests
        </Link>
      </div>
    );
  }

  const status = safeString(row.status) || "pending";
  const meta = safeObject(row.meta);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Supplier Signup Request</h2>
          <p className="text-sm text-slate-500">Review KYC details and approve/reject onboarding.</p>
        </div>
        <Link
          href="/admin/suppliers/requests"
          className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          Back to Requests
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Request Summary</h3>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(status)}`}>
              {status}
            </span>
          </div>
          <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <p><span className="font-medium text-slate-900">Request ID:</span> {safeString(row.id)}</p>
            <p><span className="font-medium text-slate-900">Business Type:</span> {safeString(row.business_type) || "-"}</p>
            <p><span className="font-medium text-slate-900">Company:</span> {safeString(row.company_legal_name) || "-"}</p>
            <p><span className="font-medium text-slate-900">Brand:</span> {safeString(row.brand_name) || "-"}</p>
            <p><span className="font-medium text-slate-900">City:</span> {safeString(row.city) || "-"}</p>
            <p><span className="font-medium text-slate-900">Country:</span> {safeString(row.country) || "-"}</p>
            <p><span className="font-medium text-slate-900">Website:</span> {safeString(row.website) || "-"}</p>
            <p><span className="font-medium text-slate-900">Created:</span> {formatDateTime(row.created_at)}</p>
            <p><span className="font-medium text-slate-900">Updated:</span> {formatDateTime(row.updated_at)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Approval Actions</h3>
          <SupplierRequestActions requestId={safeString(row.id)} status={status} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Contact & Compliance</h3>
          <div className="space-y-2 text-sm text-slate-700">
            <p><span className="font-medium text-slate-900">Contact Name:</span> {safeString(row.contact_name) || "-"}</p>
            <p><span className="font-medium text-slate-900">Contact Email:</span> {safeString(row.contact_email) || "-"}</p>
            <p><span className="font-medium text-slate-900">Contact Phone:</span> {safeString(row.contact_phone) || "-"}</p>
            <p><span className="font-medium text-slate-900">Alt Phone:</span> {safeString(row.alt_phone) || "-"}</p>
            <p><span className="font-medium text-slate-900">Support Email:</span> {safeString(row.support_email) || "-"}</p>
            <p><span className="font-medium text-slate-900">GSTIN:</span> {safeString(row.gstin) || "-"}</p>
            <p><span className="font-medium text-slate-900">PAN:</span> {safeString(row.pan) || "-"}</p>
            <p><span className="font-medium text-slate-900">CIN:</span> {safeString(row.cin) || "-"}</p>
            <p><span className="font-medium text-slate-900">IATA/TIDS:</span> {safeString(row.iata_code) || "-"}</p>
            <p><span className="font-medium text-slate-900">License:</span> {safeString(row.license_no) || "-"}</p>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Email Verified: {row.email_verified ? "Yes" : "No"} | Phone Verified: {row.phone_verified ? "Yes" : "No"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">KYC Documents</h3>
          {docs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              No documents uploaded.
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.type} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{doc.type.replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">{doc.fileName}</p>
                  </div>
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Link unavailable</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Meta</h3>
        <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </section>
    </div>
  );
}
