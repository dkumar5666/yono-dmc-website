import Link from "next/link";
import { ReactNode } from "react";

interface ServiceInfoPageProps {
  title: string;
  description: string;
  bullets: string[];
  icon: ReactNode;
}

export default function ServiceInfoPage({
  title,
  description,
  bullets,
  icon,
}: ServiceInfoPageProps) {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-[#199ce0]">
            {icon}
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold">{title}</h1>
          <p className="mt-3 text-slate-200 max-w-3xl">{description}</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
          <h2 className="text-2xl font-bold text-slate-900">What you can expect</h2>
          <ul className="mt-4 space-y-2 text-slate-700">
            {bullets.map((item) => (
              <li key={item} className="list-disc ml-5">
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/build-package"
              className="inline-flex items-center justify-center rounded-full bg-[#199ce0] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Build My Trip
            </Link>
            <Link
              href="/support"
              className="inline-flex items-center justify-center rounded-full border border-[#199ce0] px-5 py-2.5 text-sm font-semibold text-[#199ce0]"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
