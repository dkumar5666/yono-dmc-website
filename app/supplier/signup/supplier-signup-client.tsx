"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  SUPPLIER_BUSINESS_TYPES,
  type SupplierDocType,
} from "@/lib/supplierSignup/validators";

type Step = 1 | 2 | 3;

interface ApiErrorPayload {
  message?: string;
  error?: {
    message?: string;
    code?: string;
  };
}

interface UploadResponse {
  file?: {
    path?: string;
    file_name?: string;
    public_url?: string;
  };
}

interface SupplierDetailsState {
  business_type: string;
  company_legal_name: string;
  brand_name: string;
  address: string;
  city: string;
  pin_code: string;
  country: string;
  website: string;
  contact_name: string;
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

const INITIAL_DETAILS: SupplierDetailsState = {
  business_type: SUPPLIER_BUSINESS_TYPES[0],
  company_legal_name: "",
  brand_name: "",
  address: "",
  city: "",
  pin_code: "",
  country: "India",
  website: "",
  contact_name: "",
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

function validateStepOne(email: string, phone: string): string | null {
  if (!email.trim()) return "Primary contact email is required.";
  if (!phone.trim()) return "Primary contact mobile is required.";
  return null;
}

function validateStepTwo(data: SupplierDetailsState): string | null {
  if (!data.business_type.trim()) return "Business type is required.";
  if (!data.company_legal_name.trim()) return "Company legal name is required.";
  if (!data.address.trim()) return "Registered address is required.";
  if (!data.city.trim()) return "City is required.";
  if (!data.pin_code.trim()) return "PIN code is required.";
  if (!data.contact_name.trim()) return "Primary contact name is required.";
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
  if (!response.ok) return { ok: false, error: readErrorMessage(body, "Request failed.") };
  return { ok: true, data: body.data };
}

function TextInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {props.label}
        {props.required ? " *" : ""}
      </label>
      <input
        type={props.type || "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
      />
    </div>
  );
}

export default function SupplierSignupClient() {
  const [step, setStep] = useState<Step>(1);
  const [details, setDetails] = useState<SupplierDetailsState>(INITIAL_DETAILS);

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [requestId, setRequestId] = useState("");
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

  function updateDetail<K extends keyof SupplierDetailsState>(field: K, value: SupplierDetailsState[K]) {
    setDetails((prev) => ({ ...prev, [field]: value }));
  }

  async function onSendEmailOtp() {
    if (loading) return;
    setError(null);
    setMessage(null);
    setRequestId("");
    setRequestDeduped(false);
    const localError = validateStepOne(contactEmail, contactPhone);
    if (localError) {
      setError(localError);
      return;
    }

    setLoading(true);
    try {
      const result = await postJson<{ sent?: boolean; verified?: boolean }>(
        "/api/supplier/signup/otp/email/send",
        {
          email: contactEmail.trim().toLowerCase(),
          phone: normalizePhone(contactPhone),
        }
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
    if (!emailOtp.trim() || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await postJson<{ verified?: boolean }>("/api/supplier/signup/otp/email/verify", {
        email: contactEmail.trim().toLowerCase(),
        phone: normalizePhone(contactPhone),
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
    if (loading) return;
    setError(null);
    setMessage(null);
    setRequestId("");
    setRequestDeduped(false);
    const localError = validateStepOne(contactEmail, contactPhone);
    if (localError) {
      setError(localError);
      return;
    }

    setLoading(true);
    try {
      const result = await postJson<{ sent?: boolean; verified?: boolean }>(
        "/api/supplier/signup/otp/phone/send",
        {
          email: contactEmail.trim().toLowerCase(),
          phone: normalizePhone(contactPhone),
        }
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
    if (!phoneOtp.trim() || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await postJson<{ verified?: boolean }>("/api/supplier/signup/otp/phone/verify", {
        email: contactEmail.trim().toLowerCase(),
        phone: normalizePhone(contactPhone),
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

  function onContinueToDetails() {
    setError(null);
    setMessage(null);
    if (!emailVerified || !phoneVerified) {
      setError("Complete both email and mobile OTP verification before proceeding.");
      return;
    }
    setStep(2);
  }

  async function onSaveDetails(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!emailVerified || !phoneVerified) {
      setError("Step 1 verification must be completed first.");
      return;
    }

    const localError = validateStepTwo(details);
    if (localError) {
      setError(localError);
      return;
    }

    setLoading(true);
    try {
      const result = await postJson<{ details_saved?: boolean; request_id?: string; deduped?: boolean }>(
        "/api/supplier/signup/details",
        {
          contact_email: contactEmail.trim().toLowerCase(),
          contact_phone: normalizePhone(contactPhone),
          business_type: details.business_type,
          company_legal_name: details.company_legal_name,
          brand_name: details.brand_name || undefined,
          address: details.address,
          city: details.city,
          pin_code: details.pin_code,
          country: details.country || "India",
          website: details.website || undefined,
          contact_name: details.contact_name,
          alt_phone: details.alt_phone ? normalizePhone(details.alt_phone) : undefined,
          support_email: details.support_email ? details.support_email.trim().toLowerCase() : undefined,
          gstin: details.gstin.trim().toUpperCase(),
          pan: details.pan.trim().toUpperCase(),
          cin: details.cin || undefined,
          iata_code: details.iata_code || undefined,
          license_no: details.license_no || undefined,
          bank_meta: {
            account_name: details.bank_account_name || null,
            bank_name: details.bank_name || null,
            account_no: details.bank_account_no || null,
            ifsc: details.bank_ifsc || null,
            upi_id: details.bank_upi_id || null,
          },
        }
      );
      if (!result.ok) throw new Error(result.error || "Failed to save supplier details.");
      if (!result.data?.request_id) throw new Error("Failed to generate request id after verification.");

      setRequestId(result.data.request_id);
      setRequestDeduped(Boolean(result.data.deduped));
      setStep(3);
      setMessage("Business details saved. Upload documents and submit request.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save supplier details.");
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
      if (!response.ok) throw new Error(readErrorMessage(body, "Failed to upload document."));
      const uploaded = body.data?.file;
      const path = uploaded?.path || "";
      if (!path) throw new Error("Upload response missing file path.");

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
        <p className="mt-1 text-sm text-slate-600">Step 1 OTP verification is mandatory before step 2.</p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[11px] font-semibold ${step === 1 ? "bg-sky-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>1</span>
        Verify Contact
        <span className="text-slate-300">/</span>
        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[11px] font-semibold ${step === 2 ? "bg-sky-600 text-white" : step > 2 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>2</span>
        Business Details
        <span className="text-slate-300">/</span>
        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[11px] font-semibold ${step === 3 ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-700"}`}>3</span>
        Documents + Submit
      </div>

      {step === 1 ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <TextInput label="Primary Contact Email" type="email" required value={contactEmail} onChange={setContactEmail} placeholder="contact@company.com" />
          <TextInput label="Primary Contact Mobile" required value={contactPhone} onChange={setContactPhone} placeholder="+919876543210" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">Email OTP</p>
                {emailVerified ? <span className="text-xs font-medium text-emerald-700">Verified</span> : null}
              </div>
              <button type="button" onClick={() => void onSendEmailOtp()} disabled={loading || emailVerified} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60">
                {emailVerified ? "Email Verified" : "Send Email OTP"}
              </button>
              {emailOtpSent && !emailVerified ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input value={emailOtp} onChange={(event) => setEmailOtp(event.target.value)} placeholder="Enter email OTP" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
                  <button type="button" onClick={() => void onVerifyEmailOtp()} disabled={loading || !emailOtp.trim()} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    Verify OTP
                  </button>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">Mobile OTP</p>
                {phoneVerified ? <span className="text-xs font-medium text-emerald-700">Verified</span> : null}
              </div>
              <button type="button" onClick={() => void onSendPhoneOtp()} disabled={loading || phoneVerified} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60">
                {phoneVerified ? "Mobile Verified" : "Send Mobile OTP"}
              </button>
              {phoneOtpSent && !phoneVerified ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value)} placeholder="Enter mobile OTP" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
                  <button type="button" onClick={() => void onVerifyPhoneOtp()} disabled={loading || !phoneOtp.trim()} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    Verify OTP
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onContinueToDetails} disabled={loading || !emailVerified || !phoneVerified} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue to Business Details
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <form className="space-y-4" onSubmit={(event) => void onSaveDetails(event)} noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Business Type *</label>
              <select value={details.business_type} onChange={(event) => updateDetail("business_type", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20">
                {SUPPLIER_BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <TextInput label="Company Legal Name" required value={details.company_legal_name} onChange={(v) => updateDetail("company_legal_name", v)} />
            <TextInput label="Brand / Trading Name" value={details.brand_name} onChange={(v) => updateDetail("brand_name", v)} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Registered Address *</label>
              <textarea value={details.address} onChange={(event) => updateDetail("address", event.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
            </div>
            <TextInput label="City" required value={details.city} onChange={(v) => updateDetail("city", v)} />
            <TextInput label="PIN Code" required value={details.pin_code} onChange={(v) => updateDetail("pin_code", v)} />
            <TextInput label="Country" required value={details.country} onChange={(v) => updateDetail("country", v)} />
            <TextInput label="Website URL" value={details.website} onChange={(v) => updateDetail("website", v)} />
            <TextInput label="Primary Contact Name" required value={details.contact_name} onChange={(v) => updateDetail("contact_name", v)} />
            <TextInput label="Alternate Phone" value={details.alt_phone} onChange={(v) => updateDetail("alt_phone", v)} />
            <TextInput label="Support Email" type="email" value={details.support_email} onChange={(v) => updateDetail("support_email", v)} />
            <TextInput label="GSTIN" required value={details.gstin} onChange={(v) => updateDetail("gstin", v.toUpperCase())} />
            <TextInput label="PAN" required value={details.pan} onChange={(v) => updateDetail("pan", v.toUpperCase())} />
            <TextInput label="CIN" value={details.cin} onChange={(v) => updateDetail("cin", v)} />
            <TextInput label="IATA / TIDS" value={details.iata_code} onChange={(v) => updateDetail("iata_code", v)} />
            <TextInput label="Tourism / Trade License No." value={details.license_no} onChange={(v) => updateDetail("license_no", v)} />

            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Bank Details (Optional at request stage)</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <TextInput label="Account name" value={details.bank_account_name} onChange={(v) => updateDetail("bank_account_name", v)} />
                <TextInput label="Bank name" value={details.bank_name} onChange={(v) => updateDetail("bank_name", v)} />
                <TextInput label="Account no. (masked if needed)" value={details.bank_account_no} onChange={(v) => updateDetail("bank_account_no", v)} />
                <TextInput label="IFSC" value={details.bank_ifsc} onChange={(v) => updateDetail("bank_ifsc", v)} />
                <TextInput label="UPI ID" value={details.bank_upi_id} onChange={(v) => updateDetail("bank_upi_id", v)} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue to Documents
          </button>
        </form>
      ) : null}

      {step === 3 ? (
        <form className="space-y-5" onSubmit={(event) => void onSubmitRequest(event)}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Request ID: <span className="font-mono text-slate-800">{requestId}</span>
            {requestDeduped ? <span className="ml-2 text-amber-700">(existing request resumed)</span> : null}
          </div>
          <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Step 3: Documents Upload</h3>
            <p className="text-xs text-slate-600">Allowed formats: PDF, JPG, JPEG, PNG (max 10MB).</p>
            <div className="space-y-2">
              {DOC_CONFIG.map((doc) => (
                <div key={doc.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{doc.label}{doc.required ? " *" : ""}</p>
                    {uploadedDocs[doc.key]?.path ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Uploaded
                      </span>
                    ) : null}
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { const next = event.target.files?.[0] || null; void onUploadDoc(doc.key, next); }} disabled={Boolean(uploading[doc.key])} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-700" />
                </div>
              ))}
            </div>
          </section>
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input type="checkbox" checked={declarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
            <span>I confirm the information is correct and I agree to verification and compliance checks.</span>
          </label>
          <button type="submit" disabled={loading || submitSuccess || !declarationAccepted || !requiredDocsUploaded} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {submitSuccess ? "Submitted" : "Submit Request"}
          </button>
        </form>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      {step === 3 && requestId ? (
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
