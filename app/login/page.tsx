"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Smartphone, ShieldCheck } from "lucide-react";

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
      google_state_mismatch: "Google login session expired. Please try again.",
      google_env: "Google login is not configured correctly.",
      google_oauth_not_configured: "Google login is not configured correctly.",
      google_token: "Unable to complete Google login token exchange.",
      google_token_exchange_failed: "Unable to complete Google login token exchange.",
      google_userinfo: "Unable to fetch Google profile.",
      google_userinfo_failed: "Unable to fetch Google profile.",
      google_profile: "Google account profile is incomplete.",
      google_profile_missing: "Google account profile is incomplete.",
      google_missing_code: "Google callback did not include an authorization code.",
      google_email_missing: "Google account email is required to continue.",
      google_provider_error: "Google login was cancelled or failed at provider.",
      google_auth_failed: "Google login failed due to a server error. Please try again.",
      google_persist: "Unable to complete Google login. Please try again.",
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <Link href="/" aria-label="Yono DMC home" className="inline-flex">
            <Image
              src="/logo.png"
              alt="Yono DMC"
              width={200}
              height={60}
              className="h-14 w-auto"
              priority
            />
          </Link>
        </div>

        <div className="mt-6 max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm px-8 py-7">
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === "forgot"
              ? "Reset your password"
              : otpSent && !resetToken
                ? "Let's confirm your mobile"
                : "Sign in or create an account"}
          </h1>
          <p className="text-sm text-slate-600 mt-2">{modeSubtitle()}</p>

          {mode === "login" && !otpSent && (
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="mt-6 w-full bg-[#199ce0] text-white rounded-xl px-4 py-3 font-semibold inline-flex items-center justify-center gap-3 hover:opacity-90 transition"
            >
              <span className="h-8 w-8 rounded-lg bg-white text-[#199ce0] font-bold inline-flex items-center justify-center">
                G
              </span>
              Sign in with Google
            </button>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-400 my-6">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={getFormSubmitHandler()} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            )}

            <input
              type="tel"
              placeholder="Mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />

            {otpSent && !resetToken && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="6-digit code"
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
                    ? `Request another code in ${cooldownSeconds}s`
                    : "Request another code"}
                </button>
              </div>
            )}

            {mode === "forgot" && resetToken && (
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2 bg-[#199ce0] hover:opacity-90 transition"
            >
              {otpSent ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {busy
                ? "Please wait..."
                : mode === "forgot" && resetToken
                  ? "Set new password"
                  : otpSent
                    ? "Continue"
                    : mode === "forgot"
                      ? "Send code"
                      : mode === "signup"
                        ? "Create account"
                        : "Continue"}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-600 space-y-2">
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setOtpSent(false);
                    setOtp("");
                    resetForgotState();
                    clearAlerts();
                  }}
                  className="text-blue-700 font-semibold"
                >
                  New here? Create an account
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
                  className="block text-blue-700 font-semibold"
                >
                  Forgot password?
                </button>
              </>
            )}
            {mode === "signup" && (
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
                className="text-blue-700 font-semibold"
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setOtpSent(false);
                  setOtp("");
                  resetForgotState();
                  clearAlerts();
                }}
                className="text-blue-700 font-semibold"
              >
                Back to sign in
              </button>
            )}
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-700 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mt-4 text-sm text-green-700 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
              {message}
            </p>
          ) : null}

          <p className="mt-6 text-xs text-slate-500">
            By continuing, you agree to our Terms & Conditions and Privacy
            Policy.
          </p>
          <div className="mt-6 text-sm">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-700 font-semibold">
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
      <LoginPageContent />
    </Suspense>
  );
}
