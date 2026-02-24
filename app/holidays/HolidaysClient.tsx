"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import HolidayCard from "@/components/HolidayCard";
import { holidays } from "@/data/holidays";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseBundle(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function HolidaysClient() {
  const searchParams = useSearchParams();
  const destination = (searchParams.get("destination") ?? "").trim();
  const bundle = parseBundle(searchParams.get("bundle"));

  const filteredHolidays = useMemo(() => {
    if (!destination) return holidays;
    const query = normalize(destination);
    return holidays.filter((item) => {
      const countryMatch = normalize(item.country).includes(query);
      const titleMatch = normalize(item.title).includes(query);
      const destinationMatch = item.destinations.some((city) =>
        normalize(city).includes(query)
      );
      return countryMatch || titleMatch || destinationMatch;
    });
  }, [destination]);

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Holidays</h1>
      <p className="text-gray-600 mb-2">
        Discover handpicked domestic and international holidays by Yono DMC.
      </p>
      {destination ? (
        <p className="text-sm text-slate-700 mb-2">
          Showing results for: <span className="font-semibold">{destination}</span>
        </p>
      ) : null}
      {bundle.length > 0 ? (
        <p className="text-sm text-slate-700 mb-8">
          Bundle selected:{" "}
          <span className="font-semibold capitalize">{bundle.join(", ")}</span>
        </p>
      ) : (
        <div className="mb-8" />
      )}

      {filteredHolidays.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
          No packages found for <span className="font-semibold">{destination}</span>.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHolidays.map((item) => (
            <HolidayCard
              key={item.slug}
              title={item.title}
              description={item.description}
              slug={item.slug}
              duration={item.duration}
              priceFrom={item.priceFrom}
              image={item.image}
            />
          ))}
        </div>
      )}
    </section>
  );
}
