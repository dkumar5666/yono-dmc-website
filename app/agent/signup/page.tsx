"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";

interface ApiErrorShape {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
  };
}

interface OtpVerifySuccess {
  ok?: true;
  data?: {
    verified?: boolean;
    role?: string;
    nextPath?: string;
  };
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const row = payload as ApiErrorShape | null;
  return row?.error?.message || fallback;
}

export default function AgentSignupPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/agent/dashboard";

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [governmentId, setGovernmentId] = useState("");
  const [taxId, setTaxId] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as { user?: { role?: string } };
        if (payload.user?.role === "agent") {
          window.location.href = "/agent/dashboard";
        }
      } catch {
        // no-op
      }
    })();
  }, []);

  function validateAgentFields(): boolean {
    if (!companyName.trim()) {
      setError("Agency / company name is required for agent signup.");
      return false;
    }
    if (!governmentId.trim()) {
      setError("Government ID is required for agent signup.");
      return false;
    }
    if (!taxId.trim()) {
      setError("Tax ID is required for agent signup.");
      return false;
    }
    return true;
  }

  function buildGoogleUrl(): string {
    const params = new URLSearchParams({
      role: "agent",
      next: nextPath,
    });
    if (fullName.trim()) params.set("full_name", fullName.trim());
    if (city.trim()) params.set("city", city.trim());
    if (companyName.trim()) params.set("company_name", companyName.trim());
    if (governmentId.trim()) params.set("government_id", governmentId.trim());
    if (taxId.trim()) params.set("tax_id", taxId.trim());
    if (officeAddress.trim()) params.set("office_address", officeAddress.trim());
    return `/api/auth/supabase/google/start?${params.toString()}`;
  }

  async function onGoogleSignup() {
    setError(null);
    setMessage(null);
    if (!validateAgentFields()) return;
    window.location.href = buildGoogleUrl();
  }

  async function onSendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!validateAgentFields()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          role: "agent",
          fullName: fullName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          governmentId: governmentId.trim() || undefined,
          taxId: taxId.trim() || undefined,
          officeAddress: officeAddress.trim() || undefined,
          city: city.trim() || undefined,
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to send OTP"));
      }
      setOtpSent(true);
      setMessage("OTP sent successfully. Enter the verification code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          token: otp,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as OtpVerifySuccess & ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "OTP verification failed"));
      }
      if (payload.data?.role !== "agent") {
        throw new Error("This account is not configured as a travel agent.");
      }
      const next = payload.data?.nextPath || nextPath || "/agent/dashboard";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <Link href="/" aria-label="Yono DMC home">
            <Image src="/logo.png" alt="Yono DMC" width={190} height={58} className="h-14 w-auto" priority />
          </Link>
        </div>

        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Agent Signup</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create your travel agent account with required compliance details.
          </p>

          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Agency / company name *"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
            <input
              type="text"
              required
              value={governmentId}
              onChange={(e) => setGovernmentId(e.target.value)}
              placeholder="Government ID (PAN / Registration) *"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
            <input
              type="text"
              required
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="Tax ID (GST) *"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
            <input
              type="text"
              value={officeAddress}
              onChange={(e) => setOfficeAddress(e.target.value)}
              placeholder="Office address"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
          </div>

          <button
            type="button"
            onClick={() => void onGoogleSignup()}
            className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-[#199ce0]">
              G
            </span>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={otpSent ? onVerifyOtp : onSendOtp} className="space-y-3">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number (+91...)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
            {otpSent ? (
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Phone className="h-4 w-4" />
              {loading ? "Please wait..." : otpSent ? "Verify OTP" : "Continue with OTP"}
            </button>
          </form>

          <div className="mt-5 text-sm">
            <Link href={`/agent/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#199ce0]">
              Already have an agent account? Sign in
            </Link>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          ) : null}

          <div className="mt-6 text-sm">
            <Link href="/" className="inline-flex items-center gap-2 font-semibold text-[#199ce0]">
              <ArrowLeft className="h-4 w-4" />
              Back to website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
