"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          window.location.href = "/admin/catalog";
        }
      } catch {
        // no-op
      } finally {
        setCheckingSession(false);
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { error?: string; user?: { role: string } };
      if (!response.ok) {
        throw new Error(data.error ?? "Login failed");
      }
      setMessage(`Logged in as ${data.user?.role ?? "user"}. Redirecting...`);
      window.location.href = "/admin/catalog";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(25,156,224,0.15),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(245,153,28,0.14),_transparent_40%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl shadow-slate-900/10 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-10 text-white lg:block">
            <div className="mb-10 flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-2">
                <Image src="/logo.png" alt="Yono DMC" width={56} height={56} className="h-14 w-auto" />
              </div>
              <div>
                <p className="text-lg font-semibold">Yono DMC</p>
                <p className="text-sm text-white/70">Travel Operations Console</p>
              </div>
            </div>

            <h2 className="text-3xl font-semibold leading-tight">
              Manage destinations, packages, blog content and customer requests.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
              Use your admin credentials to access the catalog tools and operational modules.
            </p>

            <div className="mt-10 space-y-4 text-sm text-white/85">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Central catalog management with CSV import/export workflows.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Destination, package, attractions, blog and AI conversation modules.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Protected admin session with role-aware backend APIs.
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2">
                <Image src="/logo.png" alt="Yono DMC" width={44} height={44} className="h-11 w-auto" />
                <div>
                  <p className="font-semibold text-slate-900">Yono DMC</p>
                  <p className="text-xs text-slate-500">Admin Panel</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Secure Access
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
                Admin Sign In
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Sign in to manage destinations, holiday packages, attractions and content.
              </p>
            </div>

            {checkingSession ? (
              <div className="space-y-4">
                <div className="h-11 animate-pulse rounded-xl bg-slate-200" />
                <div className="h-11 animate-pulse rounded-xl bg-slate-200" />
                <div className="h-11 animate-pulse rounded-xl bg-slate-300" />
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#199ce0] focus-within:ring-4 focus-within:ring-[#199ce0]/10">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <input
                      required
                      autoComplete="username"
                      placeholder="admin@yonodmc.in"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-11 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-[#199ce0] focus-within:ring-4 focus-within:ring-[#199ce0]/10">
                    <LockKeyhole className="h-4 w-4 text-slate-400" />
                    <input
                      required
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </label>

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#199ce0] to-[#0f7fca] px-4 text-sm font-semibold text-white shadow-lg shadow-[#199ce0]/20 transition hover:from-[#158dcf] hover:to-[#0b73bd] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Signing in..." : "Sign in"}
                </button>
              </form>
            )}

            <div className="mt-6 border-t border-slate-200 pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to website
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
