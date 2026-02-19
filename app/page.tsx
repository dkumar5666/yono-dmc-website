"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  destinations as seedDestinations,
  testimonials,
  whatsappLink,
} from "@/data/mockData";

import { holidays } from "@/data/holidays";
import { travelTips } from "@/data/travelTips";
import HolidayCard from "@/components/HolidayCard";
import WhatsAppButton from "@/components/WhatsAppButton";

import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plane,
  Hotel,
  Palmtree,
  FileText,
} from "lucide-react";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function HomePage() {
  const [searchTab, setSearchTab] = useState<
    "holidays" | "flights" | "hotels" | "visa"
  >("holidays");
  const [destinations, setDestinations] = useState(seedDestinations);
  const [cardsPerView, setCardsPerView] = useState(4);
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [packageCardsPerView, setPackageCardsPerView] = useState(4);
  const [packageIndex, setPackageIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        const response = await fetch("/api/catalog");
        if (!response.ok) return;

        const data = (await response.json()) as {
          destinations?: typeof seedDestinations;
        };
        if (!active) return;

        if (Array.isArray(data.destinations) && data.destinations.length > 0) {
          setDestinations(data.destinations);
        }
      } catch {
        // Keep seeded fallback data if catalog fetch fails.
      }
    }

    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 640) {
        setCardsPerView(1);
        setPackageCardsPerView(1);
        return;
      }
      if (window.innerWidth < 1024) {
        setCardsPerView(2);
        setPackageCardsPerView(2);
        return;
      }
      setCardsPerView(4);
      setPackageCardsPerView(4);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const maxDestinationIndex = Math.max(destinations.length - cardsPerView, 0);
  const safeDestinationIndex = Math.min(destinationIndex, maxDestinationIndex);
  const featuredHolidays = holidays.slice(0, 10);
  const maxPackageIndex = Math.max(
    featuredHolidays.length - packageCardsPerView,
    0
  );
  const safePackageIndex = Math.min(packageIndex, maxPackageIndex);

  function handlePrevDestination() {
    setDestinationIndex((current) => Math.max(current - 1, 0));
  }

  function handleNextDestination() {
    setDestinationIndex((current) => Math.min(current + 1, maxDestinationIndex));
  }

  function handlePrevPackage() {
    setPackageIndex((current) => Math.max(current - 1, 0));
  }

  function handleNextPackage() {
    setPackageIndex((current) => Math.min(current + 1, maxPackageIndex));
  }

  return (
    <div className="min-h-screen">
      {/* ================= HERO ================= */}
      <section className="relative min-h-[520px] md:min-h-[580px] flex items-center justify-center">
        <div className="absolute inset-0">
          <Image
            src="/api/images/hero"
            alt="Hero"
            fill
            className="object-cover"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-teal-900/80" />
        </div>

          <div className="relative z-10 text-center text-white max-w-5xl mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Discover Your Perfect Trip
            </h1>

            <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-4 md:p-6 max-w-5xl mx-auto text-left">
              <div className="flex gap-3 md:gap-4 mb-4 border-b overflow-x-auto">
                {[
                  { key: "holidays", label: "Holidays", icon: Palmtree },
                  { key: "flights", label: "Flights", icon: Plane },
                  { key: "hotels", label: "Hotels", icon: Hotel },
                  { key: "visa", label: "Visa", icon: FileText },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() =>
                      setSearchTab(
                        tab.key as "holidays" | "flights" | "hotels" | "visa"
                      )
                    }
                    className={`pb-3 px-3 md:px-4 font-semibold whitespace-nowrap inline-flex items-center gap-1.5 ${
                      searchTab === tab.key
                        ? "border-b-2 border-teal-500 text-teal-600"
                        : "text-gray-600"
                    }`}
                  >
                    <tab.icon size={18} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-4 gap-3 md:gap-4">
                <input className="border p-3 rounded-lg text-gray-800" placeholder="From City" />
                <input className="border p-3 rounded-lg text-gray-800" placeholder="Destination" />
                <input type="date" className="border p-3 rounded-lg text-gray-800" />
                <a
                  href={whatsappLink}
                  className="bg-amber-500 text-white rounded-lg flex items-center justify-center gap-2 font-semibold"
                >
                  <Search className="w-5 h-5" />
                  Get Best Price
                </a>
              </div>
            </div>

            <div className="flex justify-center mt-6">
              <a
                href="#packages"
                className="inline-flex items-center justify-center bg-white hover:bg-gray-100 text-blue-900 px-8 py-4 rounded-full font-semibold"
              >
                View Packages
              </a>
            </div>
          </div>
      </section>

      {/* ================= TOP DESTINATIONS ================= */}
      <section className="bg-gray-100 py-16 md:py-20 mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8 md:mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
              Top Destinations
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevDestination}
                disabled={safeDestinationIndex === 0}
                className="h-10 w-10 rounded-full border border-gray-300 bg-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Previous destinations"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleNextDestination}
                disabled={safeDestinationIndex >= maxDestinationIndex}
                className="h-10 w-10 rounded-full border border-gray-300 bg-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Next destinations"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{
                transform: `translateX(-${safeDestinationIndex * (100 / cardsPerView)}%)`,
              }}
            >
              {destinations.map((d) => {
                const country = d.country ?? d.name;
                const cities =
                  d.cities && d.cities.length > 0 ? d.cities.join(", ") : d.tagline;
                const destinationSlug = toSlug(country);

                return (
                  <div
                    key={`home-destination-${d.id}`}
                    className="px-2 md:px-3 shrink-0"
                    style={{ width: `${100 / cardsPerView}%` }}
                  >
                    <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="relative h-40 md:h-44">
                        <Image
                          src={d.image}
                          alt={d.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                          unoptimized={d.image.startsWith("/api/images/")}
                        />
                      </div>
                      <div className="p-4 md:p-5">
                        <h3 className="text-2xl md:text-xl font-semibold text-slate-900 mb-1 leading-tight">
                          {country}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          <span className="font-semibold">Cities:</span> {cities}
                        </p>
                        <Link
                          href={`/destinations/${destinationSlug}`}
                          className="text-blue-600 font-medium hover:text-blue-700 text-lg md:text-base"
                        >
                          View Packages &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {maxDestinationIndex > 0 && (
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: maxDestinationIndex + 1 }).map((_, i) => (
                <button
                  key={`destination-dot-${i}`}
                  type="button"
                  onClick={() => setDestinationIndex(i)}
                  className={`h-2.5 rounded-full transition-all ${
                    i === safeDestinationIndex ? "w-8 bg-blue-900" : "w-2.5 bg-gray-400"
                  }`}
                  aria-label={`Go to destination slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================= PACKAGES ================= */}
      <section id="packages" className="max-w-7xl mx-auto px-4 py-20">
        <div className="flex items-center justify-between mb-8 md:mb-10">
          <h2 className="text-4xl font-bold">Popular Holiday Packages</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevPackage}
              disabled={safePackageIndex === 0}
              className="h-10 w-10 rounded-full border border-gray-300 bg-white disabled:opacity-40 flex items-center justify-center"
              aria-label="Previous packages"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNextPackage}
              disabled={safePackageIndex >= maxPackageIndex}
              className="h-10 w-10 rounded-full border border-gray-300 bg-white disabled:opacity-40 flex items-center justify-center"
              aria-label="Next packages"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="text-center mb-10">
          <p className="text-gray-600">
            Handpicked international destinations just for you
          </p>
        </div>

        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(-${safePackageIndex * (100 / packageCardsPerView)}%)`,
            }}
          >
            {featuredHolidays.map((item) => (
              <div
                key={`home-package-${item.slug}`}
                className="px-2 md:px-3 shrink-0"
                style={{ width: `${100 / packageCardsPerView}%` }}
              >
                <HolidayCard
                  title={item.title}
                  description={item.description}
                  slug={item.slug}
                  duration={item.duration}
                  priceFrom={item.priceFrom}
                  image={item.image}
                />
              </div>
            ))}
          </div>
        </div>

        {maxPackageIndex > 0 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: maxPackageIndex + 1 }).map((_, i) => (
              <button
                key={`package-dot-${i}`}
                type="button"
                onClick={() => setPackageIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === safePackageIndex ? "w-8 bg-blue-900" : "w-2.5 bg-gray-400"
                }`}
                aria-label={`Go to package slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href="/holidays"
            className="inline-flex items-center justify-center bg-[#199ce0] hover:opacity-90 text-white px-8 py-3 rounded-full font-semibold"
          >
            View All Holidays
          </Link>
        </div>
      </section>

      {/* ================= CONTACT + EMAIL SIGNUP ================= */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <h2 className="text-3xl font-bold mb-3">Contact Us</h2>
              <p className="text-gray-600 mb-6">
                Speak with our travel expert for customized packages, visa support, and best offers.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-[#199ce0] text-white px-6 py-3 rounded-full font-semibold hover:opacity-90"
                >
                  Open Contact Page
                </Link>
                <a
                  href="tel:+919958839319"
                  className="inline-flex items-center justify-center border border-gray-300 px-6 py-3 rounded-full font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Call +91 99588 39319
                </a>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <h2 className="text-3xl font-bold mb-3">Email Signup</h2>
              <p className="text-gray-600 mb-6">
                Get destination updates, travel tips, and special package deals directly in your inbox.
              </p>
              <form className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="flex-1 border border-gray-300 rounded-full px-5 py-3 text-gray-800"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center bg-[#f5991c] text-white px-6 py-3 rounded-full font-semibold hover:opacity-90"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRAVEL TIPS ================= */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-4xl font-bold mb-3">Travel Tips & Guides</h2>
              <p className="text-gray-600">
                Destination guides and practical travel tips for better planning.
              </p>
            </div>
            <Link href="/travel-tips-guides" className="font-semibold text-[#199ce0]">
              View All Posts &rarr;
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {travelTips.slice(0, 3).map((post) => (
              <article
                key={post.slug}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative h-52">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover"
                    unoptimized={post.image.startsWith("/api/images/")}
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-2xl md:text-xl font-semibold text-slate-900 mb-2">{post.title}</h3>
                  <p className="text-gray-600 mb-3">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                    <span>{post.date}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <Link href={`/travel-tips-guides/${post.slug}`} className="font-semibold text-[#199ce0]">
                    View Post
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CUSTOMER REVIEWS ================= */}
      <section className="bg-blue-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-4xl font-bold mb-3">Customer Reviews</h2>
              <p className="text-blue-100">Read client experiences and feedback.</p>
            </div>
            <Link href="/customer-reviews" className="font-semibold text-white underline">
              View All Reviews
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-white/10 p-6 rounded-2xl">
                <p className="italic mb-4">&ldquo;{t.comment}&rdquo;</p>
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
