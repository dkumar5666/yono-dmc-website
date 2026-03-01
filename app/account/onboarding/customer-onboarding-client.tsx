"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserCircle2 } from "lucide-react";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  nationality: string | null;
  city: string | null;
  dob: string | null;
  preferred_airport: string | null;
  passport_no: string | null;
  passport_expiry: string | null;
  pan: string | null;
  travel_type: string | null;
  profile_completed: boolean;
};

const TRAVEL_TYPES = ["family", "honeymoon", "solo", "business"];

function readError(payload: unknown, fallback: string): string {
  const row = payload as { error?: { message?: string } } | null;
  return row?.error?.message || fallback;
}

export default function CustomerOnboardingClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/account/profile", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as { data?: { profile?: Profile } };
        if (!response.ok) {
          throw new Error(readError(payload, "Failed to load profile"));
        }
        setProfile(payload.data?.profile || null);
        if (payload.data?.profile?.profile_completed) {
          window.location.href = "/account";
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const completionHint = useMemo(() => {
    if (!profile) return "Loading profile...";
    if (!profile.phone_verified) return "Verify your mobile number to continue.";
    if (!profile.full_name || !profile.city || !profile.nationality) return "Complete basic travel profile.";
    return "Almost done. Finish preferences to activate your account.";
  }, [profile]);

  async function patchProfile(patch: Record<string, unknown>, okMessage?: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { profile?: Profile };
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(readError(payload, "Failed to save profile"));
      }
      setProfile(payload.data?.profile || null);
      if (okMessage) setSuccess(okMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function sendPhoneOtp(event: FormEvent) {
    event.preventDefault();
    if (!profile?.phone) {
      setError("Enter mobile number first.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/customer-auth/phone-verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: profile.phone }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(readError(payload, "Failed to send OTP"));
      }
      setOtpSent(true);
      setSuccess("OTP sent to your mobile.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setSaving(false);
    }
  }

  async function verifyPhoneOtp(event: FormEvent) {
    event.preventDefault();
    if (!profile?.phone) {
      setError("Enter mobile number first.");
      return;
    }
    if (!otp.trim()) {
      setError("Enter OTP.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/customer-auth/phone-verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: profile.phone, otp: otp.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(readError(payload, "Failed to verify OTP"));
      }
      await patchProfile(
        {
          phone: profile.phone,
          phone_verified: true,
        },
        "Mobile number verified."
      );
      setOtp("");
      setOtpSent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify OTP");
    } finally {
      setSaving(false);
    }
  }

  async function finalizeOnboarding() {
    if (!profile?.phone_verified) {
      setError("Mobile verification is required.");
      setStep(1);
      return;
    }
    if (!profile?.full_name || !profile?.nationality || !profile?.city) {
      setError("Complete required fields in Identity and Travel Profile.");
      setStep(2);
      return;
    }

    await patchProfile({ profile_completed: true }, "Onboarding completed.");
    setTimeout(() => {
      window.location.href = "/account";
    }, 600);
  }

  if (loading) {
    return (
      <section className="mx-auto min-h-[70vh] w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-xl bg-slate-200" />
          <div className="h-72 rounded-2xl bg-slate-200" />
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mx-auto min-h-[70vh] w-full max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Unable to load onboarding profile.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-sky-50 via-white to-orange-50 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#199ce0]">Account Setup</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Complete your travel profile</h1>
          <p className="mt-2 text-sm text-slate-600">{completionHint}</p>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {[
              "1. Identity",
              "2. Travel Profile",
              "3. Travel Documents",
              "4. Preferences",
            ].map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(idx + 1)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                  step === idx + 1 ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              OTP verification is mandatory before you can access bookings.
            </div>
          </aside>

          <div className="space-y-4">
            {step === 1 ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <UserCircle2 className="h-5 w-5 text-[#199ce0]" />
                  <h2 className="text-lg font-semibold text-slate-900">Identity</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Full Name</span>
                    <input
                      value={profile.full_name || ""}
                      onChange={(e) => setProfile((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))}
                      onBlur={() => void patchProfile({ full_name: profile.full_name || null })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Email</span>
                    <input
                      value={profile.email || ""}
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-500"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#199ce0]" />
                      <p className="text-sm font-semibold text-slate-900">Mobile OTP Verification</p>
                    </div>
                    {profile.phone_verified ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Verified
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      value={profile.phone || ""}
                      onChange={(e) => setProfile((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
                      placeholder="+9199XXXXXXXX"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                    <button
                      type="button"
                      onClick={(e) => void sendPhoneOtp(e)}
                      disabled={saving || profile.phone_verified}
                      className="rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "..." : "Send OTP"}
                    </button>
                  </div>
                  {otpSent && !profile.phone_verified ? (
                    <form onSubmit={(e) => void verifyPhoneOtp(e)} className="mt-3 flex flex-wrap gap-2">
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="6-digit OTP"
                        className="min-w-[180px] flex-1 rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                      />
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Verify OTP
                      </button>
                    </form>
                  ) : null}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <h2 className="text-lg font-semibold text-slate-900">Travel Profile</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Nationality</span>
                    <input
                      value={profile.nationality || ""}
                      onChange={(e) => setProfile((prev) => (prev ? { ...prev, nationality: e.target.value } : prev))}
                      onBlur={() => void patchProfile({ nationality: profile.nationality || null }, "Saved")}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">City</span>
                    <input
                      value={profile.city || ""}
                      onChange={(e) => setProfile((prev) => (prev ? { ...prev, city: e.target.value } : prev))}
                      onBlur={() => void patchProfile({ city: profile.city || null }, "Saved")}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Date of Birth (optional)</span>
                    <input
                      type="date"
                      value={profile.dob || ""}
                      onChange={(e) => setProfile((prev) => (prev ? { ...prev, dob: e.target.value } : prev))}
                      onBlur={() => void patchProfile({ dob: profile.dob || null }, "Saved")}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Preferred Airport</span>
                    <input
                      value={profile.preferred_airport || ""}
                      onChange={(e) =>
                        setProfile((prev) => (prev ? { ...prev, preferred_airport: e.target.value } : prev))
                      }
                      onBlur={() => void patchProfile({ preferred_airport: profile.preferred_airport || null }, "Saved")}
                      placeholder="DEL / BOM / BLR"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Continue
                </button>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <h2 className="text-lg font-semibold text-slate-900">Travel Documents (optional)</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Passport Number</span>
                    <input
                      value={profile.passport_no || ""}
                      onChange={(e) =>
                        setProfile((prev) => (prev ? { ...prev, passport_no: e.target.value.toUpperCase() } : prev))
                      }
                      onBlur={() => void patchProfile({ passport_no: profile.passport_no || null }, "Saved")}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Passport Expiry</span>
                    <input
                      type="date"
                      value={profile.passport_expiry || ""}
                      onChange={(e) =>
                        setProfile((prev) => (prev ? { ...prev, passport_expiry: e.target.value } : prev))
                      }
                      onBlur={() => void patchProfile({ passport_expiry: profile.passport_expiry || null }, "Saved")}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="font-medium text-slate-700">PAN (India compliance hint)</span>
                    <input
                      value={profile.pan || ""}
                      onChange={(e) => setProfile((prev) => (prev ? { ...prev, pan: e.target.value.toUpperCase() } : prev))}
                      onBlur={() => void patchProfile({ pan: profile.pan || null }, "Saved")}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Continue
                </button>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <h2 className="text-lg font-semibold text-slate-900">Preferences</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TRAVEL_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setProfile((prev) => (prev ? { ...prev, travel_type: type } : prev));
                        void patchProfile({ travel_type: type }, "Preference saved");
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize ${
                        (profile.travel_type || "").toLowerCase() === type
                          ? "border-[#199ce0] bg-sky-50 text-[#199ce0]"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void finalizeOnboarding()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Finish Setup
                </button>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            ) : null}
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
