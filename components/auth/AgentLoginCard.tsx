"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, Smartphone } from "lucide-react";

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

function normalizePhoneForSubmit(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("+")) {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export default function AgentLoginCard() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/agent/dashboard";

  const [phoneRaw, setPhoneRaw] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizedPhone = useMemo(() => normalizePhoneForSubmit(phoneRaw), [phoneRaw]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { user?: { role?: string } };
        if (payload.user?.role === "agent") {
          window.location.href = "/agent/dashboard";
        }
      } catch {
        // no-op
      }
    })();
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function clearNotices() {
    setError(null);
    setSuccess(null);
  }

  async function onGoogleLogin() {
    clearNotices();
    const query = new URLSearchParams({
      role: "agent",
      next: nextPath,
    });
    window.location.href = `/api/auth/supabase/google/start?${query.toString()}`;
  }

  async function sendOtpRequest() {
    clearNotices();

    if (!normalizedPhone) {
      setError("Enter a valid mobile number. Use +country format or 10-digit India number.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          role: "agent",
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to send OTP"));
      }
      setOtpSent(true);
      setResendSeconds(30);
      setSuccess("OTP sent successfully. Enter the 6-digit code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onSendOtp(event: FormEvent) {
    event.preventDefault();
    await sendOtpRequest();
  }

  async function onVerifyOtp(event: FormEvent) {
    event.preventDefault();
    clearNotices();

    if (!normalizedPhone) {
      setError("Phone number is invalid. Request a new OTP.");
      return;
    }
    if (!otpCode.trim()) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          token: otpCode.trim(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as OtpVerifySuccess & ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "OTP verification failed"));
      }
      if (payload.data?.role !== "agent") {
        throw new Error("This account is not configured as a travel agent.");
      }

      const resolvedNext = payload.data?.nextPath || nextPath || "/agent/dashboard";
      window.location.href = resolvedNext;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function onResendOtp() {
    if (resendSeconds > 0 || loading) return;
    await sendOtpRequest();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void onGoogleLogin()}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : null}
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-sky-100 text-sm font-semibold text-sky-700">
          G
        </span>
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={otpSent ? onVerifyOtp : onSendOtp} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="agent-phone" className="block text-sm font-medium text-slate-700">
            Mobile number
          </label>
          <input
            id="agent-phone"
            type="tel"
            required
            value={phoneRaw}
            onChange={(event) => setPhoneRaw(event.target.value)}
            placeholder="+91 9876543210"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="text-xs text-slate-500">Use +country format, or enter a 10-digit India number.</p>
        </div>

        {otpSent ? (
          <div className="space-y-1.5">
            <label htmlFor="agent-otp" className="block text-sm font-medium text-slate-700">
              OTP code
            </label>
            <input
              id="agent-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
              placeholder="Enter 6-digit OTP"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
          {otpSent ? <MailCheck className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          {loading ? "Please wait..." : otpSent ? "Verify OTP" : "Send OTP"}
        </button>
      </form>

      {otpSent ? (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">Didn’t receive the code?</span>
          <button
            type="button"
            disabled={resendSeconds > 0 || loading}
            onClick={() => void onResendOtp()}
            className="font-semibold text-sky-600 transition hover:text-sky-700 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend OTP"}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="mt-5 text-sm">
        <Link
          href={`/agent/signup?next=${encodeURIComponent(nextPath)}`}
          className="font-semibold text-sky-600 hover:text-sky-700"
        >
          Need an agent account? Create account
        </Link>
      </div>
    </div>
  );
}
