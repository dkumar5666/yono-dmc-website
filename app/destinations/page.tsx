"use client";

import { useEffect, useState } from "react";
import DestinationCard from "@/components/DestinationCard";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Destination, destinations as seedDestinations } from "@/data/mockData";
import { holidays } from "@/data/holidays";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>(seedDestinations);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/catalog");
        if (!response.ok) return;
        const data = (await response.json()) as { destinations?: Destination[] };
        if (Array.isArray(data.destinations) && data.destinations.length > 0) {
          setDestinations(data.destinations);
        }
      } catch {
        // Keep fallback seed destinations
      }
    })();
  }, []);

  const packageCountByCountry = holidays.reduce<Record<string, number>>((acc, item) => {
    const key = toSlug(item.country);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ================= HERO ================= */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Explore Destinations
          </h1>
          <p className="text-xl text-gray-300">
            Discover amazing places around the world
          </p>
        </div>
      </section>

      {/* ================= DESTINATIONS GRID ================= */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {destinations.map((destination) => {
            const country = destination.country ?? destination.name;
            const slug = toSlug(country);
            const packageCount = packageCountByCountry[slug] ?? destination.packages;

            return (
            <DestinationCard
              key={destination.id}
              destination={{ ...destination, packages: packageCount }}
              href={`/destinations/${slug}`}
            />
            );
          })}
        </div>

        {/* ================= CTA ================= */}
        <div className="bg-teal-500 text-white rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Can&apos;t Find Your Dream Destination?
          </h2>
          <p className="text-xl mb-6">
            Tell us where you want to go and we&apos;ll create a custom
            package for you
          </p>
          <WhatsAppButton
            text="Get Custom Package"
            className="bg-white text-teal-600 hover:bg-gray-100"
          />
        </div>
      </section>
    </div>
  );
}
