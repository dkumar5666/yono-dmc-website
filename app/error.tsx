"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("APP ERROR:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Something went wrong</h2>
        <p className="text-gray-600 mb-6">
          We could not load this page right now. Please retry.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-[#199ce0] text-white font-semibold"
          >
            Retry
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-slate-700 font-semibold"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

