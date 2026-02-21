"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("GLOBAL APP ERROR:", error);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
          <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Unexpected error</h2>
            <p className="text-gray-600 mb-6">
              The app hit an unexpected issue. Please retry.
            </p>
            <button
              type="button"
              onClick={reset}
              className="px-5 py-2.5 rounded-lg bg-[#199ce0] text-white font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

