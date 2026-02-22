import Link from "next/link";
import { Compass, MapPin, Sparkles } from "lucide-react";
import { holidays } from "@/data/holidays";

interface AttractionsPageProps {
  searchParams?: {
    destination?: string | string[];
  };
}

function readParam(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

type AttractionCard = {
  key: string;
  title: string;
  destination: string;
  summary: string;
  packageSlug: string;
  packageTitle: string;
};

export default function AttractionsPage({ searchParams }: AttractionsPageProps) {
  const destination = readParam(searchParams?.destination, "");
  const q = normalize(destination);

  const activities: AttractionCard[] = holidays.flatMap((pkg) =>
    pkg.highlights.map((highlight, idx) => ({
      key: `${pkg.slug}-${idx}`,
      title: highlight,
      destination: pkg.country,
      summary: pkg.description,
      packageSlug: pkg.slug,
      packageTitle: pkg.title,
    }))
  );

  const filtered = activities.filter((item) => {
    if (!q) return true;
    return (
      normalize(item.destination).includes(q) ||
      normalize(item.title).includes(q) ||
      normalize(item.packageTitle).includes(q)
    );
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Things To Do</h1>
          <p className="mt-3 text-slate-200 max-w-3xl">
            Discover top activities from our destination packages and continue to
            booking instantly.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 mb-8 inline-flex items-center gap-2 text-slate-700">
          <MapPin className="h-4 w-4 text-[#199ce0]" />
          <span>
            Destination filter:{" "}
            <span className="font-semibold">{destination || "All destinations"}</span>
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-700">
              No activities found for <span className="font-semibold">{destination}</span>.
            </p>
            <Link
              href="/holidays"
              className="mt-4 inline-flex rounded-full bg-[#199ce0] px-5 py-2.5 text-white font-semibold"
            >
              Explore Holiday Packages
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <article
                key={item.key}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <Compass className="h-5 w-5 text-[#199ce0]" />
                  </span>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {item.destination}
                  </p>
                </div>

                <h2 className="mt-3 text-xl font-bold text-slate-900 leading-snug">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{item.summary}</p>

                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Mapped Package</p>
                  <p className="font-semibold text-slate-900">{item.packageTitle}</p>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/holidays/${item.packageSlug}`}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-[#199ce0] px-4 py-2.5 text-white text-sm font-semibold hover:opacity-90"
                  >
                    View Package
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center rounded-full border border-[#f5991c] px-4 py-2.5 text-sm font-semibold text-[#f5991c]"
                  >
                    <Sparkles className="mr-1 h-4 w-4" />
                    Enquire
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
