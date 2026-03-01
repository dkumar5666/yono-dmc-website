"use client";

import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

interface ApiErrorShape {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
  };
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const row = payload as ApiErrorShape | null;
  return row?.error?.message || fallback;
}

export default function OfficialLoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { user?: { role?: string } };
        if (payload.user?.role === "admin" || payload.user?.role === "staff") {
          window.location.href = "/admin/control-center";
        }
      } catch {
        // no-op
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          expectedRoles: ["admin", "staff"],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape & {
        data?: { role?: string };
      };
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Official login failed"));
      }
      if (payload.data?.role !== "admin" && payload.data?.role !== "staff") {
        throw new Error("This account is not configured for official access.");
      }
      window.location.href = "/admin/control-center";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Official login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="official-email" className="block text-sm font-medium text-slate-700">
            Work email
          </label>
          <input
            id="official-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@yonodmc.in"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="text-xs text-slate-500">Use your official Yono DMC office credentials.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="official-password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="official-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
          <p className="text-xs text-slate-500">This portal is for authorized staff only.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
          <ShieldCheck className="h-4 w-4" />
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
    </div>
  );
}
