import Link from "next/link";

interface HotelsPageProps {
  searchParams?: {
    destination?: string | string[];
    date?: string | string[];
    travelers?: string | string[];
  };
}

function readParam(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default function HotelsPage({ searchParams }: HotelsPageProps) {
  const destination = readParam(searchParams?.destination, "your destination");
  const date = readParam(searchParams?.date, "any date");
  const travelers = readParam(searchParams?.travelers, "2 travelers, 1 room");

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Stays</h1>
        <p className="text-slate-600 mb-6">
          Showing stay options for <span className="font-semibold">{destination}</span>,{" "}
          <span className="font-semibold">{date}</span>,{" "}
          <span className="font-semibold">{travelers}</span>.
        </p>
        <p className="text-slate-700">
          Stay booking module is ready for next integration step.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-[#199ce0] text-white px-6 py-3 rounded-full font-semibold hover:opacity-90"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </main>
  );
}
