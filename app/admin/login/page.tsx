"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          window.location.href = "/admin/catalog";
        }
      } catch {
        // no-op
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-4"
      >
        <h1 className="text-2xl font-bold">Office Staff / Admin Login</h1>
        <p className="text-sm text-gray-600">
          Sign in to manage destinations and holiday packages.
        </p>

        <input
          required
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-slate-900 text-white rounded-lg px-4 py-2 disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign In"}
        </button>

        <div className="text-sm">
          <Link href="/" className="text-blue-700 hover:underline">
            Back to website
          </Link>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
      </form>
    </div>
  );
}
