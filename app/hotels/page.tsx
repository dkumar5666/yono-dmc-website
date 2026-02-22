import Link from "next/link";
import { BedDouble, CalendarDays, MapPin, Users } from "lucide-react";
import { holidays } from "@/data/holidays";

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

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export default function HotelsPage({ searchParams }: HotelsPageProps) {
  const destination = readParam(searchParams?.destination, "");
  const date = readParam(searchParams?.date, "");
  const travelers = readParam(searchParams?.travelers, "2 travelers, 1 room");

  const filtered = holidays.filter((pkg) => {
    if (!destination) return true;
    const destinationQuery = normalize(destination);
    const country = normalize(pkg.country);
    const hotelCity = pkg.hotels.some((hotel) =>
      normalize(hotel.city).includes(destinationQuery)
    );
    const destinationHit = pkg.destinations.some((d) =>
      normalize(d).includes(destinationQuery)
    );
    return country.includes(destinationQuery) || hotelCity || destinationHit;
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Stays</h1>
          <p className="mt-3 text-slate-200 max-w-3xl">
            Explore curated stays from our destination packages. Filter by destination
            and continue to package booking directly.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 mb-8 grid gap-3 md:grid-cols-3">
          <div className="inline-flex items-center gap-2 text-slate-700">
            <MapPin className="h-4 w-4 text-[#199ce0]" />
            <span className="text-sm md:text-base">
              Destination:{" "}
              <span className="font-semibold">{destination || "Any destination"}</span>
            </span>
          </div>
          <div className="inline-flex items-center gap-2 text-slate-700">
            <CalendarDays className="h-4 w-4 text-[#199ce0]" />
            <span className="text-sm md:text-base">
              Date: <span className="font-semibold">{date || "Flexible"}</span>
            </span>
          </div>
          <div className="inline-flex items-center gap-2 text-slate-700">
            <Users className="h-4 w-4 text-[#199ce0]" />
            <span className="text-sm md:text-base">
              Travelers: <span className="font-semibold">{travelers}</span>
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-700">
              No stay options found for <span className="font-semibold">{destination}</span>.
            </p>
            <Link
              href="/holidays"
              className="mt-4 inline-flex rounded-full bg-[#199ce0] px-5 py-2.5 text-white font-semibold"
            >
              Browse All Packages
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((pkg) => (
              <article
                key={pkg.slug}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 mb-3">
                  <BedDouble className="h-5 w-5 text-[#199ce0]" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 leading-snug">{pkg.title}</h2>
                <p className="text-sm text-slate-600 mt-1">{pkg.country}</p>

                <div className="mt-4 space-y-2">
                  {pkg.hotels.slice(0, 2).map((hotel, idx) => (
                    <div key={`${pkg.slug}-hotel-${idx}`} className="rounded-xl bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{hotel.hotelName}</p>
                      <p className="text-sm text-slate-600">
                        {hotel.city} | {hotel.category}
                      </p>
                      <p className="text-sm text-slate-600">
                        {hotel.roomType} | {hotel.mealPlan}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-slate-600">{pkg.duration}</p>
                  <p className="text-sm font-semibold text-[#f5991c]">{pkg.priceFrom}</p>
                </div>

                <Link
                  href={`/holidays/${pkg.slug}`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#199ce0] px-5 py-2.5 text-white font-semibold hover:opacity-90"
                >
                  View Package & Book
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
