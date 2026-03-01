"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";

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

interface MeSuccessShape {
  ok?: true;
  data?: {
    user?: {
      id?: string;
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
    };
    needs_phone_verification?: boolean;
    profile_completed?: boolean;
  };
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const row = payload as ApiErrorShape | null;
  return row?.error?.message || fallback;
}

function sanitizeNextPath(nextPath: string | null): string {
  if (!nextPath) return "/my-trips";
  if (!nextPath.startsWith("/")) return "/my-trips";
  if (nextPath.startsWith("//")) return "/my-trips";
  return nextPath;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const requiresPhoneVerificationParam = searchParams.get("require_mobile_otp") === "1";
  const supportWhatsAppUrl =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL?.trim() || "https://wa.me/919958839319";
  const oauthError = searchParams.get("error");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState<"mobile" | "email">("mobile");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meChecked, setMeChecked] = useState(false);
  const [mustVerifyPhone, setMustVerifyPhone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oauthErrorMessage = useMemo(() => {
    if (!oauthError) return null;
    const map: Record<string, string> = {
      google_state_mismatch: "Google login session expired. Please try again.",
      google_missing_code: "Google callback did not include a code.",
      google_provider_error: "Google login was cancelled or failed.",
      google_token_exchange_failed: "Google token exchange failed. Please retry.",
      google_auth_failed: "Google login failed. Please retry.",
      supabase_auth_not_configured: "Supabase Auth is not configured yet.",
    };
    return map[oauthError] || "Login failed. Please try again.";
  }, [oauthError]);

  useEffect(() => {
    if (!oauthErrorMessage) return;
    setError(oauthErrorMessage);
  }, [oauthErrorMessage]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json().catch(() => ({}))) as MeSuccessShape;
          const needsPhoneVerification = Boolean(payload?.data?.needs_phone_verification);
          const profileCompleted = Boolean(payload?.data?.profile_completed);
          if (requiresPhoneVerificationParam || needsPhoneVerification) {
            setMustVerifyPhone(true);
            const existingPhone = payload?.data?.user?.phone || "";
            if (existingPhone) setPhone(existingPhone);
          } else if (!profileCompleted) {
            window.location.href = "/account/onboarding";
          } else {
            window.location.href = nextPath;
          }
          return;
        }

        if (requiresPhoneVerificationParam) {
          setError("Please sign in with Google first, then verify mobile OTP.");
        }
      } catch {
        // no-op
      } finally {
        setMeChecked(true);
      }
    })();
  }, [nextPath, requiresPhoneVerificationParam]);

  async function onGoogleLogin() {
    setError(null);
    setMessage(null);
    const query = new URLSearchParams({
      next: nextPath,
    });
    window.location.href = `/api/auth/supabase/google/start?${query.toString()}`;
  }

  function switchOtpMode(mode: "mobile" | "email") {
    setOtpMode(mode);
    setOtpSent(false);
    setOtp("");
    setError(null);
    setMessage(null);
  }

  async function onSendMobileOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to send OTP"));
      }
      setOtpSent(true);
      setMessage("OTP sent. Enter the verification code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyMobileOtp(e: FormEvent) {
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
      const next = payload.data?.nextPath || nextPath || "/my-trips";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSendEmailOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to send email OTP"));
      }
      setOtpSent(true);
      setMessage("Email OTP sent. Enter the verification code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyEmailOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token: otp,
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as OtpVerifySuccess & ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Email OTP verification failed"));
      }
      const next = payload.data?.nextPath || nextPath || "/my-trips";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSendPhoneVerificationOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/customer-auth/phone-verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to send OTP"));
      }
      setOtpSent(true);
      setMessage("OTP sent. Enter the verification code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyPhoneAfterGoogle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/customer-auth/phone-verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "OTP verification failed"));
      }
      window.location.href = "/account/onboarding";
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  const showPhoneVerificationStep = mustVerifyPhone;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <Link href="/" aria-label="Yono DMC home">
            <Image src="/logo.png" alt="Yono DMC" width={190} height={58} className="h-14 w-auto" priority />
          </Link>
        </div>

        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Customer Login</h1>
          <p className="mt-2 text-sm text-slate-600">
            {showPhoneVerificationStep
              ? "Google login is complete. Verify your mobile OTP to continue."
              : "Sign in with Google or mobile OTP to view your trips, payments, and documents."}
          </p>

          {showPhoneVerificationStep ? (
            <form onSubmit={otpSent ? onVerifyPhoneAfterGoogle : onSendPhoneVerificationOtp} className="mt-6 space-y-3">
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
                disabled={loading || !meChecked}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                <Smartphone className="h-4 w-4" />
                {loading ? "Please wait..." : otpSent ? "Verify OTP" : "Send Mobile OTP"}
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void onGoogleLogin()}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90"
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

              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => switchOtpMode("mobile")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    otpMode === "mobile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Mobile OTP
                </button>
                <button
                  type="button"
                  onClick={() => switchOtpMode("email")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    otpMode === "email" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Email OTP
                </button>
              </div>

              <form
                onSubmit={
                  otpMode === "mobile"
                    ? otpSent
                      ? onVerifyMobileOtp
                      : onSendMobileOtp
                    : otpSent
                      ? onVerifyEmailOtp
                      : onSendEmailOtp
                }
                className="space-y-3"
              >
                {otpMode === "mobile" ? (
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Mobile number (+91...)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                  />
                ) : (
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                  />
                )}
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
                  <Smartphone className="h-4 w-4" />
                  {loading
                    ? "Please wait..."
                    : otpSent
                      ? "Verify OTP"
                      : otpMode === "mobile"
                        ? "Send OTP"
                        : "Send Email OTP"}
                </button>
              </form>

              <p className="mt-2 text-xs text-slate-500">
                Email OTP is a fallback when mobile OTP is unavailable.
              </p>

              <div className="mt-5 text-sm">
                <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#199ce0]">
                  New here? Create an account
                </Link>
              </div>
            </>
          )}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          ) : null}

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">Need help signing in?</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href={supportWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#199ce0] hover:underline"
              >
                Support WhatsApp
              </a>
              <Link href="/support" className="font-semibold text-[#199ce0] hover:underline">
                FAQ & Support
              </Link>
            </div>
          </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginContent />
    </Suspense>
  );
}
