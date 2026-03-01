"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, CreditCard, FileText, Gift, Loader2, Shield, UserCircle2, Users } from "lucide-react";

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

type Traveller = {
  id: string;
  name: string | null;
  passport_no: string | null;
  expiry_date: string | null;
  relationship: string | null;
};

type Wallet = {
  customer_id: string;
  balance: number;
  tier: string;
};

const SIDEBAR_ITEMS = [
  "Profile",
  "My Trips",
  "Wallet & Credits",
  "Travellers",
  "Documents",
  "Rewards",
  "Notifications",
  "Support",
  "Security",
  "Logout",
];

function readError(payload: unknown, fallback: string): string {
  const row = payload as { error?: { message?: string } } | null;
  return row?.error?.message || fallback;
}

function money(value?: number): string {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CustomerAccountClient({ firstName }: { firstName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [travellers, setTravellers] = useState<Traveller[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [newTraveller, setNewTraveller] = useState({
    name: "",
    passport_no: "",
    expiry_date: "",
    relationship: "",
  });

  const tierLabel = useMemo(() => wallet?.tier || "Explorer", [wallet?.tier]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/account/profile", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          data?: { profile?: Profile; travellers?: Traveller[]; wallet?: Wallet };
        };
        if (!response.ok) {
          throw new Error(readError(payload, "Failed to load account"));
        }
        setProfile(payload.data?.profile || null);
        setTravellers(payload.data?.travellers || []);
        setWallet(payload.data?.wallet || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile(patch: Record<string, unknown>, okMessage = "Saved") {
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
      };
      if (!response.ok) {
        throw new Error(readError(payload, "Failed to save profile"));
      }
      setProfile(payload.data?.profile || null);
      setSuccess(okMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function addTraveller(event: FormEvent) {
    event.preventDefault();
    if (!newTraveller.name.trim()) {
      setError("Traveller name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/account/travellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTraveller),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { row?: Traveller };
      };
      if (!response.ok) {
        throw new Error(readError(payload, "Failed to add traveller"));
      }
      if (payload.data?.row) {
        setTravellers((prev) => [payload.data!.row!, ...prev]);
      }
      setNewTraveller({ name: "", passport_no: "", expiry_date: "", relationship: "" });
      setSuccess("Traveller added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add traveller");
    } finally {
      setSaving(false);
    }
  }

  async function removeTraveller(id: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/account/travellers?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readError(payload, "Failed to remove traveller"));
      }
      setTravellers((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Traveller removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove traveller");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 rounded-xl bg-slate-200" />
          <div className="h-[520px] rounded-2xl bg-slate-200" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 via-white to-orange-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#199ce0]">Hi, {profile?.full_name?.split(" ")[0] || firstName}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Your Travel Account</h1>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Tier</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{tierLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Wallet Balance</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{money(wallet?.balance)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Upcoming Trip</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Check My Trips</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <UserCircle2 className="h-4 w-4 text-[#199ce0]" />
                Basic Information
              </h2>
              <div className="space-y-2">
                <input
                  value={profile?.full_name || ""}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, full_name: e.target.value } : prev))}
                  onBlur={() => void saveProfile({ full_name: profile?.full_name || null })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                  placeholder="Full name"
                />
                <input
                  value={profile?.city || ""}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, city: e.target.value } : prev))}
                  onBlur={() => void saveProfile({ city: profile?.city || null })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                  placeholder="City"
                />
                <input
                  value={profile?.nationality || ""}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, nationality: e.target.value } : prev))}
                  onBlur={() => void saveProfile({ nationality: profile?.nationality || null })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                  placeholder="Nationality"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <Shield className="h-4 w-4 text-[#199ce0]" />
                Contact Details
              </h2>
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Email:</span> {profile?.email || "Not available"}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Mobile:</span>{" "}
                  {profile?.phone || "Not available"}{" "}
                  {profile?.phone_verified ? (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Verified
                    </span>
                  ) : (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Pending
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <FileText className="h-4 w-4 text-[#199ce0]" />
                Travel Documents
              </h2>
              <div className="space-y-2">
                <input
                  value={profile?.passport_no || ""}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, passport_no: e.target.value } : prev))}
                  onBlur={() => void saveProfile({ passport_no: profile?.passport_no || null })}
                  placeholder="Passport Number"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                />
                <input
                  type="date"
                  value={profile?.passport_expiry || ""}
                  onChange={(e) =>
                    setProfile((prev) => (prev ? { ...prev, passport_expiry: e.target.value } : prev))
                  }
                  onBlur={() => void saveProfile({ passport_expiry: profile?.passport_expiry || null })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                />
                <input
                  value={profile?.pan || ""}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, pan: e.target.value.toUpperCase() } : prev))}
                  onBlur={() => void saveProfile({ pan: profile?.pan || null })}
                  placeholder="PAN"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <Users className="h-4 w-4 text-[#199ce0]" />
                Additional Travellers
              </h2>
              <form onSubmit={(e) => void addTraveller(e)} className="grid gap-2">
                <input
                  value={newTraveller.name}
                  onChange={(e) => setNewTraveller((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Traveller name"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={newTraveller.relationship}
                    onChange={(e) => setNewTraveller((prev) => ({ ...prev, relationship: e.target.value }))}
                    placeholder="Relationship"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                  />
                  <input
                    value={newTraveller.passport_no}
                    onChange={(e) => setNewTraveller((prev) => ({ ...prev, passport_no: e.target.value }))}
                    placeholder="Passport No."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Add Traveller
                </button>
              </form>

              <div className="mt-3 space-y-2">
                {travellers.length === 0 ? (
                  <p className="text-sm text-slate-500">No travellers added yet.</p>
                ) : (
                  travellers.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{row.name || "Traveller"}</p>
                        <p className="text-xs text-slate-500">{row.relationship || "Relationship not set"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeTraveller(row.id)}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Gift className="h-4 w-4 text-[#199ce0]" />
                Rewards & Loyalty
              </h3>
              <p className="text-sm text-slate-600">Tier: {tierLabel}. Rewards modules are future-ready.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Bell className="h-4 w-4 text-[#199ce0]" />
                Notifications
              </h3>
              <p className="text-sm text-slate-600">Manage booking, payment, and support updates.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CreditCard className="h-4 w-4 text-[#199ce0]" />
                Wallet & Credits
              </h3>
              <p className="text-sm text-slate-600">Available balance: {money(wallet?.balance)}</p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}
          {success ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {success}
            </div>
          ) : null}
          {saving ? (
            <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
