import Link from "next/link";

interface AttractionsPageProps {
  searchParams?: {
    destination?: string | string[];
  };
}

function readParam(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default function AttractionsPage({ searchParams }: AttractionsPageProps) {
  const destination = readParam(searchParams?.destination, "your destination");

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Things To Do</h1>
        <p className="text-slate-600 mb-6">
          Curated activities and experiences for{" "}
          <span className="font-semibold">{destination}</span>.
        </p>
        <p className="text-slate-700">
          Attractions booking module is ready for next integration step.
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
