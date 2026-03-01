"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#199ce0]">Yono DMC</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
        We could not load this page right now. Please retry. If the issue continues, contact support.
      </p>
      {error?.digest ? (
        <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#148bc7]"
        >
          Try Again
        </button>
        <Link
          href="/support"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          Contact Support
        </Link>
      </div>
    </main>
  );
}
