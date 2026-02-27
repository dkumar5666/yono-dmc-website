import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

interface AuthShellProps {
  title: string;
  subtitle: string;
  roleBadge: string;
  children: ReactNode;
  highlightsTitle?: string;
  highlights?: string[];
}

export default function AuthShell({
  title,
  subtitle,
  roleBadge,
  children,
  highlightsTitle = "Portal Highlights",
  highlights = [],
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_45%,#f8fafc_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-12">
          <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
            <div>
              <Link href="/" aria-label="Yono DMC home" className="inline-flex items-center gap-3">
                <Image src="/logo.png" alt="Yono DMC" width={160} height={52} className="h-10 w-auto" priority />
                <span className="text-base font-semibold tracking-tight text-slate-900">Yono DMC</span>
              </Link>
              <span className="mt-6 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                {roleBadge}
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{subtitle}</p>
            </div>

            {highlights.length > 0 ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{highlightsTitle}</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 lg:col-span-7">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

