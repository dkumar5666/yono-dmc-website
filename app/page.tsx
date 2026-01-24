"use client";

import { useState } from "react";
import Image from "next/image";
import {
  packages,
  destinations,
  testimonials,
  whatsappLink,
} from "@/data/mockData";

import PackageCard from "@/components/PackageCard";
import { DestinationCard } from "@/components/DestinationCard";
import { WhatsAppButton } from "@/components/WhatsAppButton";


import {
  Shield,
  HeadphonesIcon,
  BadgeCheck,
  DollarSign,
  Search,
} from "lucide-react";

export default function HomePage() {
  const [searchTab, setSearchTab] = useState<
    "holidays" | "flights" | "hotels" | "visa"
  >("holidays");

  return (
    <div className="min-h-screen">
      {/* ================= HERO ================= */}
      <section className="relative h-[600px] flex items-center justify-center">
        <div className="absolute inset-0">
            src="https://images.unsplash.com/photo-1768069794857-9306ac167c6e"
            alt="Hero"
            fill
            className="object-cover"
            priority
         {'>'}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-teal-900/80" />
        </div>

        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Customized International Holidays by Trusted DMC
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">
            Dubai • Singapore • Malaysia • Bali
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <WhatsAppButton
              text="Plan My Trip on WhatsApp"
              className="text-lg px-8 py-4"
            />
            <a
              href="#packages"
              className="inline-flex items-center justify-center bg-white hover:bg-gray-100 text-blue-900 px-8 py-4 rounded-full font-semibold"
            >
              View Packages
            </a>
          </div>
        </div>
      </section>

      {/* ================= QUICK ENQUIRY ================= */}
      <section className="max-w-7xl mx-auto px-4 -mt-20 relative z-20">
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex gap-4 mb-6 border-b">
            {(["holidays", "flights", "hotels", "visa"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSearchTab(tab)}
                className={`pb-3 px-4 font-semibold capitalize ${
                  searchTab === tab
                    ? "border-b-2 border-teal-500 text-teal-600"
                    : "text-gray-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <input className="border p-3 rounded-lg" placeholder="From City" />
            <input className="border p-3 rounded-lg" placeholder="Destination" />
            <input type="date" className="border p-3 rounded-lg" />
            <a
              href={whatsappLink}
              className="bg-amber-500 text-white rounded-lg flex items-center justify-center gap-2 font-semibold"
            >
              <Search className="w-5 h-5" />
              Get Best Price
            </a>
          </div>
        </div>
      </section>

      {/* ================= PACKAGES ================= */}
      <section
        id="packages"
        className="max-w-7xl mx-auto px-4 py-20"
      >
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Popular Holiday Packages
          </h2>
          <p className="text-gray-600">
            Handpicked international destinations just for you
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} package={pkg} />
          ))}
        </div>
      </section>

      {/* ================= DESTINATIONS ================= */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Top Destinations
            </h2>
            <p className="text-gray-600">
              Explore the world's most beautiful places
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {destinations.map((d) => (
              <DestinationCard key={d.id} destination={d} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= WHY CHOOSE ================= */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Why Choose YONO DMC
          </h2>
          <p className="text-gray-600 mb-12">
            Your trusted travel partner
          </p>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-8">
            {[
              { icon: <DollarSign />, title: "Direct DMC Pricing" },
              { icon: <BadgeCheck />, title: "Custom Itineraries" },
              { icon: <Shield />, title: "Visa Assistance" },
              { icon: <HeadphonesIcon />, title: "24x7 Support" },
              { icon: <BadgeCheck />, title: "No Hidden Charges" },
            ].map((f, i) => (
              <div key={i}>
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-teal-100 text-teal-600 rounded-full">
                  {f.icon}
                </div>
                <h4 className="font-semibold">{f.title}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section className="bg-blue-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-12">
            Trusted by 1000+ Travelers
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-white/10 p-6 rounded-2xl">
                <p className="italic mb-4">"{t.comment}"</p>
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm opacity-80">{t.location}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WhatsAppButton fixed />
    </div>
  );
}
