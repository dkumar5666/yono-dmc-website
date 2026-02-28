"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  SUPPLIER_BUSINESS_TYPES,
  type SupplierDocType,
} from "@/lib/supplierSignup/validators";

type Step = 1 | 2;

interface ApiErrorPayload {
  message?: string;
  error?: {
    message?: string;
    code?: string;
  };
}

interface RequestCreateResponse {
  request_id?: string;
  deduped?: boolean;
}

interface UploadResponse {
  file?: {
    path?: string;
    file_name?: string;
    public_url?: string;
  };
}

type UploadedDocMap = Partial<
  Record<
    SupplierDocType,
    {
      fileName: string;
      path: string;
      publicUrl: string;
    }
  >
>;

const DOC_CONFIG: Array<{ key: SupplierDocType; label: string; required: boolean }> = [
  { key: "gst_certificate", label: "GST Certificate", required: true },
  { key: "pan_card", label: "PAN Card", required: true },
  { key: "business_registration", label: "Business Registration / Trade License", required: true },
  { key: "bank_proof", label: "Cancelled Cheque / Bank Proof", required: false },
  { key: "owner_id_proof", label: "Owner ID Proof", required: false },
];

interface SupplierSignupFormState {
  business_type: string;
  company_legal_name: string;
  brand_name: string;
  address: string;
  city: string;
  country: string;
  website: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  alt_phone: string;
  support_email: string;
  gstin: string;
  pan: string;
  cin: string;
  iata_code: string;
  license_no: string;
  bank_account_name: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_upi_id: string;
}

const INITIAL_STATE: SupplierSignupFormState = {
  business_type: SUPPLIER_BUSINESS_TYPES[0],
  company_legal_name: "",
  brand_name: "",
  address: "",
  city: "",
  country: "India",
  website: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  alt_phone: "",
  support_email: "",
  gstin: "",
  pan: "",
  cin: "",
  iata_code: "",
  license_no: "",
  bank_account_name: "",
  bank_name: "",
  bank_account_no: "",
  bank_ifsc: "",
  bank_upi_id: "",
};

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as ApiErrorPayload;
  return row.error?.message || row.message || fallback;
}

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

function validateStepOne(data: SupplierSignupFormState): string | null {
  if (!data.business_type.trim()) return "Business type is required.";
  if (!data.company_legal_name.trim()) return "Company legal name is required.";
  if (!data.address.trim()) return "Registered address is required.";
  if (!data.city.trim()) return "City is required.";
  if (!data.contact_name.trim()) return "Primary contact name is required.";
  if (!data.contact_email.trim()) return "Primary contact email is required.";
  if (!data.contact_phone.trim()) return "Primary contact mobile is required.";
  if (!data.gstin.trim()) return "GSTIN is required.";
  if (!data.pan.trim()) return "PAN is required.";
  return null;
}

async function postJson<T>(
  url: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as { data?: T } & ApiErrorPayload;
  if (!response.ok) {
    return { ok: false, error: readErrorMessage(body, "Request failed.") };
  }
  return { ok: true, data: body.data };
}

export default function SupplierSignupClient() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<SupplierSignupFormState>(INITIAL_STATE);
  const [requestId, setRequestId] = useState("");
  const [requestCreated, setRequestCreated] = useState(false);
  const [requestDeduped, setRequestDeduped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [uploading, setUploading] = useState<Partial<Record<SupplierDocType, boolean>>>({});
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocMap>({});
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const requiredDocsUploaded = useMemo(
    () => DOC_CONFIG.filter((doc) => doc.required).every((doc) => Boolean(uploadedDocs[doc.key]?.path)),
    [uploadedDocs]
  );

  function updateField<K extends keyof SupplierSignupFormState>(field: K, value: SupplierSignupFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onCreateRequest(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const localError = validateStepOne(form);
    if (localError) {
      setError(localError);
      return;
    }

    setLoading(true);
    try {
      const result = await postJson<RequestCreateResponse>("/api/supplier/signup/request", {
        business_type: form.business_type,
        company_legal_name: form.company_legal_name,
        brand_name: form.brand_name || undefined,
        address: form.address,
        city: form.city,
        country: form.country || "India",
        website: form.website || undefined,
        contact_name: form.contact_name,
        contact_email: form.contact_email.trim().toLowerCase(),
        contact_phone: normalizePhone(form.contact_phone),
        alt_phone: form.alt_phone ? normalizePhone(form.alt_phone) : undefined,
        support_email: form.support_email ? form.support_email.trim().toLowerCase() : undefined,
        gstin: form.gstin.trim().toUpperCase(),
        pan: form.pan.trim().toUpperCase(),
        cin: form.cin || undefined,
        iata_code: form.iata_code || undefined,
        license_no: form.license_no || undefined,
        bank_meta: {
          account_name: form.bank_account_name || null,
          bank_name: form.bank_name || null,
          account_no: form.bank_account_no || null,
          ifsc: form.bank_ifsc || null,
          upi_id: form.bank_upi_id || null,
        },
      });
      if (!result.ok || !result.data?.request_id) {
        throw new Error(result.error || "Failed to create supplier signup request.");
      }

      setRequestId(result.data.request_id);
      setRequestCreated(true);
      setRequestDeduped(Boolean(result.data.deduped));
      setStep(2);
      setMessage(
        result.data.deduped
          ? "An existing request was found. Continue verification and upload to complete it."
          : "Request draft created. Complete verification and uploads to submit."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create supplier signup request.");
    } finally {
      setLoading(false);
    }
  }

  async function onSendEmailOtp() {
    if (!requestId || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await postJson<{ sent?: boolean; verified?: boolean }>(
        "/api/supplier/signup/otp/email/send",
        { request_id: requestId }
      );
      if (!result.ok) throw new Error(result.error || "Failed to send email OTP.");
      if (result.data?.verified) {
        setEmailVerified(true);
        setMessage("Email already verified.");
      } else {
        setEmailOtpSent(true);
        setMessage("Email OTP sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyEmailOtp() {
    if (!requestId || !emailOtp.trim() || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await postJson<{ verified?: boolean }>("/api/supplier/signup/otp/email/verify", {
        request_id: requestId,
        otp: emailOtp.trim(),
      });
      if (!result.ok) throw new Error(result.error || "Failed to verify email OTP.");
      setEmailVerified(Boolean(result.data?.verified));
      setMessage("Email verified successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify email OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function onSendPhoneOtp() {
    if (!requestId || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await postJson<{ sent?: boolean; verified?: boolean }>(
        "/api/supplier/signup/otp/phone/send",
        { request_id: requestId }
      );
      if (!result.ok) throw new Error(result.error || "Failed to send mobile OTP.");
      if (result.data?.verified) {
        setPhoneVerified(true);
        setMessage("Mobile already verified.");
      } else {
        setPhoneOtpSent(true);
        setMessage("Mobile OTP sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send mobile OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyPhoneOtp() {
    if (!requestId || !phoneOtp.trim() || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await postJson<{ verified?: boolean }>("/api/supplier/signup/otp/phone/verify", {
        request_id: requestId,
        otp: phoneOtp.trim(),
      });
      if (!result.ok) throw new Error(result.error || "Failed to verify mobile OTP.");
      setPhoneVerified(Boolean(result.data?.verified));
      setMessage("Mobile verified successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify mobile OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function onUploadDoc(docType: SupplierDocType, file: File | null) {
    if (!requestId || !file) return;
    setError(null);
    setMessage(null);
    setUploading((prev) => ({ ...prev, [docType]: true }));
    try {
      const formData = new FormData();
      formData.set("request_id", requestId);
      formData.set("doc_type", docType);
      formData.set("file", file);
      const response = await fetch("/api/supplier/signup/upload", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => ({}))) as { data?: UploadResponse } & ApiErrorPayload;
      if (!response.ok) {
        throw new Error(readErrorMessage(body, "Failed to upload document."));
      }
      const uploaded = body.data?.file;
      const path = uploaded?.path || "";
      if (!path) {
        throw new Error("Upload response missing file path.");
      }
      setUploadedDocs((prev) => ({
        ...prev,
        [docType]: {
          fileName: uploaded?.file_name || file.name,
          path,
          publicUrl: uploaded?.public_url || "",
        },
      }));
      setMessage(`${DOC_CONFIG.find((item) => item.key === docType)?.label || "Document"} uploaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
    }
  }

  async function onSubmitRequest(event: FormEvent) {
    event.preventDefault();
    if (!requestId || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await postJson<{ status?: string }>("/api/supplier/signup/submit", {
        request_id: requestId,
        declaration_accepted: declarationAccepted,
      });
      if (!result.ok) throw new Error(result.error || "Failed to submit request.");
      setSubmitSuccess(true);
      setMessage("Request submitted. You'll receive approval status by email/SMS.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit supplier signup request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Supplier Signup Request</h2>
        <p className="mt-1 text-sm text-slate-600">Complete verification and documents before final submission.</p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
            step === 1 ? "bg-sky-600 text-white" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          1
        </span>
        Company + Contact
        <span className="text-slate-300">/</span>
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
            step === 2 ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700"
          }`}
        >
          2
        </span>
        Verification + Docs
      </div>

      {step === 1 ? (
        <form className="space-y-4" onSubmit={(event) => void onCreateRequest(event)} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Type *</label>
              <select
                value={form.business_type}
                onChange={(event) => updateField("business_type", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              >
                {SUPPLIER_BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Company Legal Name *</label>
              <input value={form.company_legal_name} onChange={(event) => updateField("company_legal_name", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="ABC Travels Private Limited" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Brand / Trading Name</label>
              <input value={form.brand_name} onChange={(event) => updateField("brand_name", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="ABC Holidays" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Registered Address *</label>
              <textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="Full registered address" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">City *</label>
              <input value={form.city} onChange={(event) => updateField("city", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Country *</label>
              <input value={form.country} onChange={(event) => updateField("country", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Website URL</label>
              <input value={form.website} onChange={(event) => updateField("website", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="https://example.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Primary Contact Name *</label>
              <input value={form.contact_name} onChange={(event) => updateField("contact_name", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Primary Contact Email *</label>
              <input type="email" value={form.contact_email} onChange={(event) => updateField("contact_email", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="contact@company.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Primary Contact Mobile *</label>
              <input value={form.contact_phone} onChange={(event) => updateField("contact_phone", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="+919876543210" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Alternate Phone</label>
              <input value={form.alt_phone} onChange={(event) => updateField("alt_phone", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="+911234567890" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Support Email</label>
              <input type="email" value={form.support_email} onChange={(event) => updateField("support_email", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">GSTIN *</label>
              <input value={form.gstin} onChange={(event) => updateField("gstin", event.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">PAN *</label>
              <input value={form.pan} onChange={(event) => updateField("pan", event.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">CIN</label>
              <input value={form.cin} onChange={(event) => updateField("cin", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">IATA / TIDS</label>
              <input value={form.iata_code} onChange={(event) => updateField("iata_code", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Tourism / Trade License No.</label>
              <input value={form.license_no} onChange={(event) => updateField("license_no", event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>

            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Bank Details (Optional at request stage)</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <input value={form.bank_account_name} onChange={(event) => updateField("bank_account_name", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="Account name" />
                <input value={form.bank_name} onChange={(event) => updateField("bank_name", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="Bank name" />
                <input value={form.bank_account_no} onChange={(event) => updateField("bank_account_no", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="Account no. (masked if needed)" />
                <input value={form.bank_ifsc} onChange={(event) => updateField("bank_ifsc", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="IFSC" />
                <input value={form.bank_upi_id} onChange={(event) => updateField("bank_upi_id", event.target.value)} className="sm:col-span-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" placeholder="UPI ID" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Saving..." : "Continue to Verification"}
          </button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={(event) => void onSubmitRequest(event)}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Request ID: <span className="font-mono text-slate-800">{requestId}</span>
            {requestDeduped ? <span className="ml-2 text-amber-700">(existing request resumed)</span> : null}
          </div>

          <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Email Verification</h3>
            <button type="button" onClick={() => void onSendEmailOtp()} disabled={loading || emailVerified} className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60">
              {emailVerified ? "Email Verified" : "Send Email OTP"}
            </button>
            {emailOtpSent && !emailVerified ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={emailOtp} onChange={(event) => setEmailOtp(event.target.value)} placeholder="Enter email OTP" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
                <button type="button" onClick={() => void onVerifyEmailOtp()} disabled={loading || !emailOtp.trim()} className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  Verify OTP
                </button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Mobile Verification</h3>
            <button type="button" onClick={() => void onSendPhoneOtp()} disabled={loading || phoneVerified} className="inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60">
              {phoneVerified ? "Mobile Verified" : "Send Mobile OTP"}
            </button>
            {phoneOtpSent && !phoneVerified ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value)} placeholder="Enter mobile OTP" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
                <button type="button" onClick={() => void onVerifyPhoneOtp()} disabled={loading || !phoneOtp.trim()} className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  Verify OTP
                </button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Documents Upload</h3>
            <p className="text-xs text-slate-600">Allowed formats: PDF, JPG, JPEG, PNG (max 10MB).</p>
            <div className="space-y-2">
              {DOC_CONFIG.map((doc) => (
                <div key={doc.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{doc.label}{doc.required ? " *" : ""}</p>
                    {uploadedDocs[doc.key]?.path ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Uploaded</span>
                    ) : null}
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { const next = event.target.files?.[0] || null; void onUploadDoc(doc.key, next); }} disabled={Boolean(uploading[doc.key])} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-700" />
                  {uploading[doc.key] ? <p className="mt-1 text-xs text-slate-500">Uploading...</p> : null}
                  {uploadedDocs[doc.key]?.fileName ? <p className="mt-1 text-xs text-slate-500">File: {uploadedDocs[doc.key]?.fileName}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
            <span>I confirm the information is correct and I agree to verification and compliance checks.</span>
          </label>

          <button type="submit" disabled={loading || submitSuccess || !declarationAccepted || !emailVerified || !phoneVerified || !requiredDocsUploaded} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {submitSuccess ? "Submitted" : "Submit Request"}
          </button>
        </form>
      )}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      {requestCreated ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
          Keep this request ID for reference: <span className="font-mono">{requestId}</span>
        </div>
      ) : null}

      <div className="pt-2 text-sm">
        <Link href="/supplier/login" className="inline-flex items-center gap-2 font-semibold text-sky-600 hover:text-sky-700">
          <ArrowLeft className="h-4 w-4" />
          Back to supplier login
        </Link>
      </div>
    </div>
  );
}
