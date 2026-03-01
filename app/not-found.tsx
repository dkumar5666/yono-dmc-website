import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#199ce0]">Yono DMC</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Page not found</h1>
      <p className="mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
        The page you are looking for is unavailable or has been moved. Use the links below to continue.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#148bc7]"
        >
          Go to Home
        </Link>
        <Link
          href="/support"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          Support
        </Link>
      </div>
    </main>
  );
}
