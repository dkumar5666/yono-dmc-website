"use client";

import DestinationCard from "@/components/DestinationCard";
import WhatsAppButton from "@/components/WhatsAppButton";
import { destinations } from "@/data/mockData";

export default function DestinationsPage() {
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
          {destinations.map((destination) => (
            <DestinationCard
              key={destination.id}
              destination={destination}
            />
          ))}
        </div>

        {/* ================= CTA ================= */}
        <div className="bg-teal-500 text-white rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Can't Find Your Dream Destination?
          </h2>
          <p className="text-xl mb-6">
            Tell us where you want to go and we'll create a custom
            package for you
          </p>
          <WhatsAppButton
            text="Get Custom Package"
            className="bg-white text-teal-600 hover:bg-gray-100"
          />
        </div>
      </section>

      <WhatsAppButton fixed />
    </div>
  );
}
