"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Smartphone, Mail, ShieldCheck } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot";

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

function extractRetryAfterSeconds(payload: unknown): number | null {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "details" in payload.error &&
    payload.error.details &&
    typeof payload.error.details === "object" &&
    "retryAfterSeconds" in payload.error.details &&
    typeof payload.error.details.retryAfterSeconds === "number"
  ) {
    return payload.error.details.retryAfterSeconds;
  }
  return null;
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";
  const oauthError = searchParams.get("error");
  const [mode, setMode] = useState<AuthMode>("login");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (me.ok) window.location.href = nextPath;
      } catch {
        // no-op
      }
    })();
  }, [nextPath]);

  useEffect(() => {
    if (!oauthError) return;
    const errorMap: Record<string, string> = {
      google_state: "Google login session expired. Please try again.",
      google_env: "Google login is not configured correctly.",
      google_token: "Unable to complete Google login token exchange.",
      google_userinfo: "Unable to fetch Google profile.",
      google_profile: "Google account profile is incomplete.",
    };
    setError(errorMap[oauthError] ?? "Google login failed. Please try again.");
  }, [oauthError]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  function clearAlerts() {
    setMessage(null);
    setError(null);
  }

  function resetForgotState() {
    setResetToken(null);
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleGoogleLogin() {
    clearAlerts();
    const nextQuery = encodeURIComponent(nextPath);
    window.location.href = `/api/customer-auth/google/start?next=${nextQuery}`;
  }

  async function sendOtpRequest() {
    clearAlerts();
    setBusy(true);
    try {
      const response = await fetch("/api/customer-auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = (await response.json()) as unknown;
      if (!response.ok) {
        const errorMessage = extractErrorMessage(data, "Failed to send OTP");
        const retryAfter = extractRetryAfterSeconds(data);
        if (retryAfter) setCooldownSeconds(retryAfter);
        throw new Error(errorMessage);
      }

      setOtpSent(true);
      const payload = data as { data?: { cooldownSeconds?: number } };
      const cooldown = payload.data?.cooldownSeconds ?? 45;
      setCooldownSeconds(cooldown);
      setMessage("OTP sent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    await sendOtpRequest();
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    clearAlerts();
    setBusy(true);
    try {
      const response = await fetch("/api/customer-auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code: otp, name: mode === "signup" ? name : undefined }),
      });
      const data = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Failed to verify OTP"));
      }

      setMessage(
        mode === "signup"
          ? "Signup completed and mobile verified."
          : mode === "forgot"
            ? "Mobile verified. Password reset flow can be connected next."
            : "Login successful."
      );
      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotVerifyOtp(e: FormEvent) {
    e.preventDefault();
    clearAlerts();
    setBusy(true);
    try {
      const response = await fetch("/api/customer-auth/password/forgot/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code: otp }),
      });
      const data = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Failed to verify OTP"));
      }

      const payload = data as { data?: { resetToken?: string } };
      if (!payload.data?.resetToken) {
        throw new Error("Reset session was not created. Please try again.");
      }
      setResetToken(payload.data.resetToken);
      setMessage("OTP verified. Set your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotResetPassword(e: FormEvent) {
    e.preventDefault();
    clearAlerts();

    if (!resetToken) {
      setError("Reset session expired. Please verify OTP again.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/customer-auth/password/forgot/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(extractErrorMessage(data, "Failed to reset password"));
      }

      setMessage("Password reset successful. You can now login.");
      setMode("login");
      setOtpSent(false);
      setOtp("");
      setMobile("");
      resetForgotState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  function getFormSubmitHandler(): (e: FormEvent) => Promise<void> {
    if (mode === "forgot") {
      if (!otpSent) return handleSendOtp;
      if (!resetToken) return handleForgotVerifyOtp;
      return handleForgotResetPassword;
    }
    return otpSent ? handleVerifyOtp : handleSendOtp;
  }

  function modeSubtitle(): string {
    if (mode === "signup") return "Create your account with mobile OTP verification.";
    if (mode === "forgot") return "Verify mobile OTP, then set a new password.";
    return "Login quickly with Gmail or mobile OTP.";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white/90 backdrop-blur border border-white rounded-3xl shadow-xl p-8 space-y-6">
        <div className="space-y-2">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Secure Access
          </span>
          <h1 className="text-3xl font-bold text-slate-900">Login / Signup</h1>
          <p className="text-sm text-slate-600">{modeSubtitle()}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setOtpSent(false);
              setOtp("");
              setMobile("");
              resetForgotState();
              clearAlerts();
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "login" ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setOtpSent(false);
              setOtp("");
              resetForgotState();
              clearAlerts();
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "signup" ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            Signup
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setOtpSent(false);
              setOtp("");
              resetForgotState();
              clearAlerts();
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "forgot" ? "bg-white shadow text-slate-900" : "text-slate-500"
            }`}
          >
            Forgot
          </button>
        </div>

        {mode === "login" && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition"
          >
            <Mail className="h-4 w-4" />
            Login with Gmail
          </button>
        )}

        <form onSubmit={getFormSubmitHandler()} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          )}

          <input
            type="tel"
            placeholder="Mobile Number (with country code if needed)"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          {otpSent && !resetToken && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={() => void sendOtpRequest()}
                disabled={busy || cooldownSeconds > 0}
                className="text-sm font-semibold text-blue-700 disabled:text-gray-400"
              >
                {cooldownSeconds > 0
                  ? `Resend OTP in ${cooldownSeconds}s`
                  : "Resend OTP"}
              </button>
            </div>
          )}

          {mode === "forgot" && resetToken && (
            <div className="space-y-2">
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <p className="text-xs text-slate-500">
                Use at least 8 characters with uppercase, lowercase, and number.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`w-full text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2 transition ${
              otpSent ? "bg-[#199ce0] hover:opacity-90" : "bg-[#f5991c] hover:opacity-90"
            }`}
          >
            {otpSent ? <ShieldCheck className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            {busy
              ? "Please wait..."
              : mode === "forgot" && resetToken
                ? "Set New Password"
                : otpSent
                ? "Verify OTP"
                : mode === "forgot"
                  ? "Send OTP for Recovery"
                  : mode === "signup"
                    ? "Send OTP for Signup"
                    : "Login with Mobile OTP"}
          </button>
        </form>

        <div className="text-sm pt-1">
          <Link href="/" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-red-700 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-green-700 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginPageContent />
    </Suspense>
  );
}
