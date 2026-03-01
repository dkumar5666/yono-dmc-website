"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type SignupStep = "identity" | "verify" | "password";

interface ApiErrorShape {
  ok?: false;
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

interface ApiSuccessShape {
  ok?: true;
  data?: {
    signup_session_id?: string;
    redirectTo?: string;
    cooldownSeconds?: number;
  };
}

function sanitizeNextPath(nextPath: string | null): string {
  if (!nextPath) return "/account/onboarding";
  if (!nextPath.startsWith("/")) return "/account/onboarding";
  if (nextPath.startsWith("//")) return "/account/onboarding";
  if (nextPath.startsWith("/api/")) return "/account/onboarding";
  return nextPath;
}

function readError(payload: unknown, fallback: string): { code: string; message: string } {
  const row = payload as ApiErrorShape | null;
  return {
    code: row?.error?.code || row?.code || "UNKNOWN",
    message: row?.error?.message || row?.message || fallback,
  };
}

function SignupContent() {
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  const [step, setStep] = useState<SignupStep>("identity");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signupSessionId, setSignupSessionId] = useState("");

  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  function resetNotices() {
    setError(null);
    setErrorCode(null);
    setMessage(null);
  }

  async function sendBothOtps() {
    const response = await fetch("/api/customer-auth/signup/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, country: "IN" }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiSuccessShape & ApiErrorShape;
    if (!response.ok) {
      const err = readError(payload, "Failed to start signup");
      setErrorCode(err.code);
      throw new Error(err.message);
    }
    const sessionId = payload.data?.signup_session_id || "";
    if (!sessionId) {
      setErrorCode("SIGNUP_SESSION_MISSING");
      throw new Error("Unable to initialize signup session. Please retry.");
    }
    setSignupSessionId(sessionId);
    setCountdown(payload.data?.cooldownSeconds || 60);
    setStep("verify");
    setMessage("Email OTP and mobile OTP have been sent.");
  }

  async function onStartSignup(e: FormEvent) {
    e.preventDefault();
    resetNotices();
    setLoading(true);
    try {
      await sendBothOtps();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start signup");
    } finally {
      setLoading(false);
    }
  }

  async function onResendOtps() {
    if (loading || countdown > 0) return;
    resetNotices();
    setLoading(true);
    try {
      await sendBothOtps();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtps(e: FormEvent) {
    e.preventDefault();
    resetNotices();
    setLoading(true);
    try {
      const response = await fetch("/api/customer-auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signup_session_id: signupSessionId,
          email_otp: emailOtp,
          phone_otp: phoneOtp,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiSuccessShape & ApiErrorShape;
      if (!response.ok) {
        const err = readError(payload, "OTP verification failed");
        setErrorCode(err.code);
        throw new Error(err.message);
      }

      setStep("password");
      setMessage("Email and mobile verified. Set your password to finish signup.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    resetNotices();
    setLoading(true);
    try {
      const response = await fetch("/api/customer-auth/signup/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signup_session_id: signupSessionId,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiSuccessShape & ApiErrorShape;
      if (!response.ok) {
        const err = readError(payload, "Failed to set password");
        setErrorCode(err.code);
        throw new Error(err.message);
      }

      window.location.href = payload.data?.redirectTo || nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete signup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <Link href="/" aria-label="Yono DMC home">
            <Image src="/logo.png" alt="Yono DMC" width={190} height={58} className="h-14 w-auto" priority />
          </Link>
        </div>

        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h1 className="text-[34px] font-semibold tracking-tight text-slate-900">Create your customer account</h1>
          <p className="mt-2 text-sm text-slate-600">
            We verify email and mobile only once during account creation.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            <span className={step === "identity" ? "text-[#2563d7]" : ""}>Step 1: Contact</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className={step === "verify" ? "text-[#2563d7]" : ""}>Step 2: Verify OTP</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className={step === "password" ? "text-[#2563d7]" : ""}>Step 3: Set Password</span>
          </div>

          {step === "identity" ? (
            <form onSubmit={onStartSignup} className="mt-5 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number (+91...)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#2563d7] px-4 py-3 font-semibold text-white hover:bg-[#1d4fc2] disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Continue"}
              </button>
            </form>
          ) : null}

          {step === "verify" ? (
            <form onSubmit={onVerifyOtps} className="mt-5 space-y-3">
              <input
                type="text"
                required
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                placeholder="Email OTP"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <input
                type="text"
                required
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value)}
                placeholder="Mobile OTP"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#2563d7] px-4 py-3 font-semibold text-white hover:bg-[#1d4fc2] disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Verify OTPs"}
              </button>
              {countdown > 0 ? (
                <p className="text-center text-sm text-slate-600">Resend OTP in {countdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void onResendOtps()}
                  disabled={loading}
                  className="w-full text-sm font-semibold text-[#2563d7] hover:underline disabled:opacity-60"
                >
                  Resend OTP
                </button>
              )}
            </form>
          ) : null}

          {step === "password" ? (
            <form onSubmit={onSetPassword} className="mt-5 space-y-3">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#2563d7] px-4 py-3 font-semibold text-white hover:bg-[#1d4fc2] disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Create account"}
              </button>
              <p className="text-xs text-slate-500">
                Password must be at least 8 characters and include uppercase, lowercase, and a number.
              </p>
            </form>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {errorCode === "ACCOUNT_EXISTS" ? (
            <div className="mt-3">
              <Link
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                className="text-sm font-semibold text-[#2563d7] hover:underline"
              >
                Account already exists. Sign in.
              </Link>
            </div>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          ) : null}

          <div className="mt-5 text-sm">
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#199ce0]">
              Already have an account? Sign in
            </Link>
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SignupContent />
    </Suspense>
  );
}

