import Link from "next/link";

interface AttractionsPageProps {
  searchParams?: Promise<{
    destination?: string;
  }>;
}

export default async function AttractionsPage({
  searchParams,
}: AttractionsPageProps) {
  const params = (await searchParams) ?? {};
  const destination = params.destination ?? "your destination";

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

