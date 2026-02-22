"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  destinations as seedDestinations,
  testimonials,
} from "@/data/mockData";

import { holidays } from "@/data/holidays";
import { travelTips as seedTravelTips } from "@/data/travelTips";
import HolidayCard from "@/components/HolidayCard";

import {
  ChevronLeft,
  ChevronRight,
  BedSingle,
  Plane,
  Package,
  Map,
  MapPin,
  CalendarDays,
  Users,
  Search,
} from "lucide-react";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MASTER_DESTINATION_META: Record<string, { tagline: string; cities: string[] }> = {
  japan: {
    tagline: "Where Tradition Meets Futuristic Innovation",
    cities: ["Tokyo", "Kyoto", "Osaka", "Hiroshima"],
  },
  "united arab emirates": {
    tagline: "Luxury, Skyscrapers & Desert Adventures",
    cities: ["Dubai", "Abu Dhabi", "Sharjah"],
  },
  indonesia: {
    tagline: "Island of Gods & Tropical Romance",
    cities: ["Ubud", "Kuta", "Seminyak", "Nusa Penida"],
  },
  singapore: {
    tagline: "Futuristic City with Tropical Charm",
    cities: ["Singapore City", "Sentosa Island"],
  },
  malaysia: {
    tagline: "Truly Asia - Culture, Cities & Beaches",
    cities: ["Kuala Lumpur", "Langkawi", "Penang", "Genting Highlands"],
  },
  vietnam: {
    tagline: "Timeless Heritage & Scenic Landscapes",
    cities: ["Hanoi", "Ha Long Bay", "Da Nang", "Ho Chi Minh City"],
  },
  thailand: {
    tagline: "Land of Smiles & Island Escapes",
    cities: ["Bangkok", "Phuket", "Krabi", "Chiang Mai"],
  },
  "south korea": {
    tagline: "K-Culture, Palaces & Coastal Beauty",
    cities: ["Seoul", "Busan", "Jeju Island", "Incheon"],
  },
  india: {
    tagline: "Incredible Diversity & Timeless Heritage",
    cities: ["Delhi", "Agra", "Jaipur", "Srinagar"],
  },
  australia: {
    tagline: "Urban Icons & Natural Wonders",
    cities: ["Sydney", "Melbourne", "Gold Coast", "Cairns"],
  },
  turkey: {
    tagline: "Where East Meets West",
    cities: ["Istanbul", "Cappadocia", "Antalya", "Pamukkale"],
  },
  mauritius: {
    tagline: "Paradise in the Indian Ocean",
    cities: ["Port Louis", "Grand Baie", "Flic-en-Flac", "Le Morne"],
  },
};

function normalizeDestinationKey(value: string): string {
  const raw = value.toLowerCase().trim();
  if (raw === "uae") return "united arab emirates";
  if (raw === "bali") return "indonesia";
  return raw;
}

function resolveDestinationMeta(input: {
  name: string;
  country?: string;
  tagline?: string;
  cities?: unknown;
}): { country: string; tagline: string; cities: string[] } {
  const country = input.country ?? input.name;
  const master = MASTER_DESTINATION_META[normalizeDestinationKey(country)];

  const inputCities = Array.isArray(input.cities)
    ? input.cities.filter((city): city is string => typeof city === "string")
    : [];
  const sanitizedCities = inputCities
    .map((city) => city.trim())
    .filter(
      (city) =>
        city.length > 0 &&
        city.toLowerCase() !== (input.tagline ?? "").toLowerCase().trim()
    );

  const cities =
    master?.cities ??
    (sanitizedCities.length > 0 ? sanitizedCities : fallbackCitiesForDestination(country));

  const tagline = master?.tagline ?? input.tagline ?? "Explore curated travel experiences";

  return { country, tagline, cities };
}

function fallbackCitiesForDestination(name: string): string[] {
  const key = name.toLowerCase().trim();
  const map: Record<string, string[]> = {
    "united arab emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
    uae: ["Dubai", "Abu Dhabi", "Sharjah"],
    indonesia: ["Bali", "Jakarta", "Ubud"],
    thailand: ["Bangkok", "Phuket", "Krabi"],
    singapore: ["Singapore City", "Sentosa"],
    malaysia: ["Kuala Lumpur", "Langkawi", "Penang"],
    japan: ["Tokyo", "Kyoto", "Osaka"],
    vietnam: ["Hanoi", "Da Nang", "Hoi An"],
    india: ["Delhi", "Agra", "Jaipur"],
    australia: ["Sydney", "Melbourne", "Gold Coast"],
    "south korea": ["Seoul", "Busan", "Incheon"],
    turkey: ["Istanbul", "Cappadocia", "Antalya"],
    mauritius: ["Port Louis", "Grand Baie", "Flic-en-Flac"],
  };
  return map[key] ?? [];
}

export default function HomePage() {
  const router = useRouter();
  const [destinations, setDestinations] = useState(seedDestinations);
  const [travelTips, setTravelTips] = useState(seedTravelTips);
  const [cardsPerView, setCardsPerView] = useState(4);
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [packageCardsPerView, setPackageCardsPerView] = useState(4);
  const [packageIndex, setPackageIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeSearchTab, setActiveSearchTab] = useState("stays");
  const [searchDestination, setSearchDestination] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [tripType, setTripType] = useState("roundtrip");
  const [cabinClass, setCabinClass] = useState("Economy");
  const [includeFlight, setIncludeFlight] = useState(false);
  const [includeStay, setIncludeStay] = useState(true);
  const [showDestinationMenu, setShowDestinationMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTravelerPicker, setShowTravelerPicker] = useState(false);

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

    async function loadBlogPosts() {
      try {
        const response = await fetch("/api/blog-posts");
        if (!response.ok) return;
        const data = (await response.json()) as { data?: typeof seedTravelTips };
        if (!active) return;
        if (Array.isArray(data.data) && data.data.length > 0) {
          setTravelTips(data.data);
        }
      } catch {
        // Keep seeded fallback data if blog fetch fails.
      }
    }

    void loadCatalog();
    void loadBlogPosts();
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
  const heroSlides =
    destinations.length > 0
      ? destinations.map((d) => {
          const resolved = resolveDestinationMeta({
            name: d.name,
            country: d.country,
            tagline: d.tagline,
            cities: d.cities,
          });
          return {
            image: d.image,
            name: resolved.country,
            tagline: resolved.tagline,
            cities: resolved.cities,
            slug: toSlug(resolved.country),
          };
        })
      : [
          {
            image: "/api/images/hero",
            name: "Destinations",
            tagline: "Explore curated travel experiences",
            cities: [] as string[],
            slug: "destinations",
          },
        ];
  const safeHeroIndex = heroSlides.length > 0 ? heroIndex % heroSlides.length : 0;
  const activeHeroSlide = heroSlides[safeHeroIndex];
  const maxPackageIndex = Math.max(
    featuredHolidays.length - packageCardsPerView,
    0
  );
  const safePackageIndex = Math.min(packageIndex, maxPackageIndex);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  function handleSearchTabChange(tabId: string) {
    setActiveSearchTab(tabId);
    setShowDestinationMenu(false);
    setShowDatePicker(false);
    setShowTravelerPicker(false);
  }

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

  const destinationSuggestions = useMemo(() => {
    const items: { label: string; subtitle?: string }[] = [];
    destinations.forEach((d) => {
      const country = d.country ?? d.name;
      items.push({ label: country, subtitle: d.tagline });
      if (Array.isArray(d.cities)) {
        d.cities.forEach((city) => items.push({ label: city, subtitle: country }));
      }
    });
    const query = searchDestination.trim().toLowerCase();
    if (!query) return items.slice(0, 8);
    return items
      .filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.subtitle?.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [destinations, searchDestination]);

  const travelerSummary = `${adults + children} travelers, ${rooms} room${
    rooms > 1 ? "s" : ""
  }`;
  const flightTravelerSummary = `${adults + children} traveler${
    adults + children > 1 ? "s" : ""
  }, ${cabinClass}`;

  async function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const destination = searchDestination || activeHeroSlide.name;
    let target = "/holidays";

    if (activeSearchTab === "flights") {
      const from = (searchFrom || "DEL").toUpperCase();
      const to = (searchTo || destination || "DXB").toUpperCase().slice(0, 3);
      const date = startDate || new Date().toISOString().slice(0, 10);
      target = `/flights?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
        to
      )}&date=${encodeURIComponent(date)}&adults=${adults}`;
    }

    if (activeSearchTab === "stays") {
      target = `/hotels?destination=${encodeURIComponent(
        destination
      )}&date=${encodeURIComponent(
        startDate
      )}&travelers=${encodeURIComponent(travelerSummary)}`;
    }

    if (activeSearchTab === "packages") {
      const flags = [
        includeStay ? "stay" : null,
        includeFlight ? "flight" : null,
      ]
        .filter(Boolean)
        .join(",");
      target = `/holidays?destination=${encodeURIComponent(
        destination
      )}&bundle=${encodeURIComponent(flags)}`;
    }

    if (activeSearchTab === "things") {
      target = `/attractions?destination=${encodeURIComponent(destination)}`;
    }

    try {
      const authCheck = await fetch("/api/customer-auth/me", {
        cache: "no-store",
      });
      if (!authCheck.ok) {
        router.push(`/login?next=${encodeURIComponent(target)}`);
        return;
      }
    } catch {
      router.push(`/login?next=${encodeURIComponent(target)}`);
      return;
    }

    router.push(target);
  }

  return (
    <div className="min-h-screen">
      {/* ================= HERO (EXPEDIA STYLE) ================= */}
      <section className="bg-white pt-2 pb-8 md:pb-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="relative rounded-2xl overflow-visible min-h-[440px] md:min-h-[500px]">
            <div className="absolute inset-0 bg-slate-900">
              {heroSlides.map((slide, i) => (
                <div
                  key={`hero-slide-${slide.slug}-${i}`}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    i === safeHeroIndex ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <Image
                    src={slide.image}
                    alt={slide.name}
                    fill
                    className="object-cover object-center"
                    priority={i === safeHeroIndex}
                    unoptimized={slide.image.startsWith("/api/images/")}
                    sizes="100vw"
                  />
                </div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-r from-black/35 to-black/20" />
            </div>

            <Link
              href={`/destinations/${activeHeroSlide.slug}`}
              className="absolute inset-0 z-10"
              aria-label={`Open ${activeHeroSlide.name} destination`}
            />

            <div className="relative z-20 pt-10 md:pt-12 text-center text-white px-4 pointer-events-none">
              <h1 className="text-4xl md:text-6xl font-semibold leading-tight drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]">
                {activeHeroSlide.name}
              </h1>
              <p className="mt-3 text-lg md:text-2xl text-white/95">
                {activeHeroSlide.tagline}
              </p>
              <p className="mt-2 text-base md:text-xl text-white/90">
                {activeHeroSlide.cities.length > 0
                  ? activeHeroSlide.cities.join(" . ")
                  : "Curated city experiences"}
              </p>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex justify-center gap-2">
              {heroSlides.map((slide, i) => (
                <button
                  key={`hero-dot-${slide.slug}-${i}`}
                  type="button"
                  onClick={() => setHeroIndex(i)}
                  className={`h-2.5 rounded-full transition-all ${
                    i === safeHeroIndex ? "w-8 bg-white" : "w-2.5 bg-white/60"
                  }`}
                  aria-label={`Go to hero slide ${i + 1}`}
                />
              ))}
            </div>

            <div className="absolute left-4 right-4 md:left-8 md:right-8 bottom-5 md:bottom-6 z-40">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 md:px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-wrap gap-5 md:gap-8">
                    {[
                      { id: "stays", label: "Stays", icon: BedSingle },
                      { id: "flights", label: "Flights", icon: Plane },
                      { id: "packages", label: "Packages", icon: Package },
                      { id: "things", label: "Things To Do", icon: Map },
                    ].map((item) => {
                      const Icon = item.icon;
                      const active = activeSearchTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSearchTabChange(item.id)}
                          className={`inline-flex items-center gap-2 pb-2 border-b-2 text-sm md:text-base font-semibold transition ${
                            active
                              ? "border-blue-600 text-blue-700"
                              : "border-transparent text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 md:h-5 md:w-5 ${
                              active ? "text-[#199ce0]" : "text-slate-500"
                            }`}
                          />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleSearchSubmit} className="p-4 md:p-6">
  {activeSearchTab === "stays" && (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <label className="h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3 text-left hover:border-gray-400 w-full">
            <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
            <input
              type="text"
              value={searchDestination}
              onChange={(e) => setSearchDestination(e.target.value)}
              onFocus={() => {
                setShowDestinationMenu(true);
                setShowDatePicker(false);
                setShowTravelerPicker(false);
              }}
              placeholder="Where to?"
              className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
            />
          </label>
          {showDestinationMenu && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-auto z-50">
              {destinationSuggestions.map((item) => (
                <button
                  key={`${item.label}-${item.subtitle ?? ""}`}
                  type="button"
                  onClick={() => {
                    setSearchDestination(item.label);
                    setShowDestinationMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50"
                >
                  <div className="font-semibold text-slate-900">{item.label}</div>
                  {item.subtitle ? (
                    <div className="text-sm text-gray-500">{item.subtitle}</div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-4 relative">
          <button
            type="button"
            onClick={() => {
              setShowDatePicker((prev) => !prev);
              setShowDestinationMenu(false);
              setShowTravelerPicker(false);
            }}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3 text-left hover:border-gray-400"
          >
            <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
            <span className="text-gray-700">
              {startDate && endDate ? `${startDate} - ${endDate}` : "Dates"}
            </span>
          </button>
          {showDatePicker && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Check-in</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Check-out</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="bg-[#199ce0] text-white px-4 py-2 rounded-full font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-3 relative">
          <button
            type="button"
            onClick={() => {
              setShowTravelerPicker((prev) => !prev);
              setShowDatePicker(false);
              setShowDestinationMenu(false);
            }}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3 text-left hover:border-gray-400"
          >
            <Users className="h-5 w-5 text-[#199ce0] shrink-0" />
            <span className="text-gray-700">{travelerSummary}</span>
          </button>
          {showTravelerPicker && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Rooms</p>
                    <p className="text-xs text-gray-500">Max 9</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRooms((prev) => Math.max(prev - 1, 1))}
                      className="h-8 w-8 rounded-full border"
                    >
                      -
                    </button>
                    <span className="font-semibold">{rooms}</span>
                    <button
                      type="button"
                      onClick={() => setRooms((prev) => Math.min(prev + 1, 9))}
                      className="h-8 w-8 rounded-full border"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Adults</p>
                    <p className="text-xs text-gray-500">Ages 18+</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAdults((prev) => Math.max(prev - 1, 1))}
                      className="h-8 w-8 rounded-full border"
                    >
                      -
                    </button>
                    <span className="font-semibold">{adults}</span>
                    <button
                      type="button"
                      onClick={() => setAdults((prev) => Math.min(prev + 1, 9))}
                      className="h-8 w-8 rounded-full border"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Children</p>
                    <p className="text-xs text-gray-500">Ages 0-17</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setChildren((prev) => Math.max(prev - 1, 0))}
                      className="h-8 w-8 rounded-full border"
                    >
                      -
                    </button>
                    <span className="font-semibold">{children}</span>
                    <button
                      type="button"
                      onClick={() => setChildren((prev) => Math.min(prev + 1, 9))}
                      className="h-8 w-8 rounded-full border"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={() => setShowTravelerPicker(false)}
                  className="bg-[#199ce0] text-white px-4 py-2 rounded-full font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="submit"
          className="md:col-span-1 h-14 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90"
        >
          <Search className="h-5 w-5" />
          <span className="md:hidden">Search</span>
        </button>
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={includeFlight}
          onChange={(e) => setIncludeFlight(e.target.checked)}
        />
        Add a flight to bundle & save
      </label>
    </>
  )}

  {activeSearchTab === "flights" && (
    <>
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-gray-700 mb-4">
        {["roundtrip", "oneway", "multicity"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTripType(type)}
            className={`pb-2 border-b-2 ${
              tripType === type
                ? "border-[#199ce0] text-[#199ce0]"
                : "border-transparent"
            }`}
          >
            {type === "roundtrip"
              ? "Roundtrip"
              : type === "oneway"
                ? "One-way"
                : "Multi-city"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <label className="md:col-span-3 h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3">
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchFrom}
            onChange={(e) => setSearchFrom(e.target.value)}
            placeholder="Leaving from"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className="md:col-span-3 h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3">
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchTo}
            onChange={(e) => setSearchTo(e.target.value)}
            placeholder="Going to"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className="md:col-span-3 h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <div className="md:col-span-2 relative">
          <button
            type="button"
            onClick={() => {
              setShowTravelerPicker((prev) => !prev);
              setShowDatePicker(false);
              setShowDestinationMenu(false);
            }}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3 text-left hover:border-gray-400"
          >
            <Users className="h-5 w-5 text-[#199ce0] shrink-0" />
            <span className="text-gray-700">{flightTravelerSummary}</span>
          </button>
          {showTravelerPicker && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Adults</p>
                    <p className="text-xs text-gray-500">Ages 18+</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAdults((prev) => Math.max(prev - 1, 1))}
                      className="h-8 w-8 rounded-full border"
                    >
                      -
                    </button>
                    <span className="font-semibold">{adults}</span>
                    <button
                      type="button"
                      onClick={() => setAdults((prev) => Math.min(prev + 1, 9))}
                      className="h-8 w-8 rounded-full border"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Children</p>
                    <p className="text-xs text-gray-500">Ages 0-17</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setChildren((prev) => Math.max(prev - 1, 0))}
                      className="h-8 w-8 rounded-full border"
                    >
                      -
                    </button>
                    <span className="font-semibold">{children}</span>
                    <button
                      type="button"
                      onClick={() => setChildren((prev) => Math.min(prev + 1, 9))}
                      className="h-8 w-8 rounded-full border"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Cabin class</label>
                  <select
                    value={cabinClass}
                    onChange={(e) => setCabinClass(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  >
                    <option>Economy</option>
                    <option>Premium Economy</option>
                    <option>Business</option>
                    <option>First</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={() => setShowTravelerPicker(false)}
                  className="bg-[#199ce0] text-white px-4 py-2 rounded-full font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          type="submit"
          className="md:col-span-1 h-14 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center"
        >
          Search
        </button>
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={includeStay}
          onChange={(e) => setIncludeStay(e.target.checked)}
        />
        Add a stay to bundle & save
      </label>
    </>
  )}

  {activeSearchTab === "packages" && (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        {[
          {
            label: "Stay added",
            active: includeStay,
            onToggle: () => setIncludeStay((prev) => !prev),
          },
          {
            label: "Flight added",
            active: includeFlight,
            onToggle: () => setIncludeFlight((prev) => !prev),
          },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.onToggle}
            className={`px-4 py-2 rounded-full border text-sm font-semibold ${
              chip.active
                ? "border-[#199ce0] text-[#199ce0]"
                : "border-gray-300 text-gray-600"
            }`}
          >
            {chip.label}
          </button>
        ))}
        <select
          value={cabinClass}
          onChange={(e) => setCabinClass(e.target.value)}
          className="px-4 py-2 rounded-full border text-sm font-semibold text-gray-700"
        >
          <option>Economy</option>
          <option>Premium Economy</option>
          <option>Business</option>
          <option>First</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <label className="md:col-span-4 h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3">
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchFrom}
            onChange={(e) => setSearchFrom(e.target.value)}
            placeholder="Leaving from"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className="md:col-span-4 h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3">
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchTo}
            onChange={(e) => setSearchTo(e.target.value)}
            placeholder="Going to"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className="md:col-span-3 h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <button
          type="submit"
          className="md:col-span-1 h-14 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center"
        >
          Search
        </button>
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" />
        I only need accommodation for part of my trip
      </label>
    </>
  )}

  {activeSearchTab === "things" && (
    <>
      <p className="text-sm text-gray-600 mb-3">
        Looking for sports, concerts, or festivals?{" "}
        <span className="text-[#199ce0] font-semibold">Search event tickets</span>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <label className="h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3 w-full">
            <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
            <input
              type="text"
              value={searchDestination}
              onChange={(e) => setSearchDestination(e.target.value)}
              onFocus={() => {
                setShowDestinationMenu(true);
                setShowDatePicker(false);
                setShowTravelerPicker(false);
              }}
              placeholder="Going to"
              className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
            />
          </label>
          {showDestinationMenu && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-auto z-50">
              {destinationSuggestions.map((item) => (
                <button
                  key={`${item.label}-${item.subtitle ?? ""}`}
                  type="button"
                  onClick={() => {
                    setSearchDestination(item.label);
                    setShowDestinationMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50"
                >
                  <div className="font-semibold text-slate-900">{item.label}</div>
                  {item.subtitle ? (
                    <div className="text-sm text-gray-500">{item.subtitle}</div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="md:col-span-5 h-14 rounded-xl border border-gray-300 px-4 inline-flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <button
          type="submit"
          className="md:col-span-1 h-14 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center"
        >
          Search
        </button>
      </div>
    </>
  )}
</form>
              </div>
            </div>
          </div>

          <div className="mt-5 md:mt-6 rounded-2xl bg-[#f5991c] text-white px-5 md:px-8 py-4 md:py-5">
            <p className="text-xl md:text-3xl font-semibold">Annual Vacation Sale</p>
            <p className="text-white/90 text-sm md:text-base mt-1">
              Members save up to 40% on select hotels and holiday bundles.
            </p>
          </div>
        </div>
      </section>

      {/* ================= TOP DESTINATIONS ================= */}
      <section className="bg-gray-100 py-6 md:py-7 mt-2">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-5 md:mb-6">
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
                <ChevronLeft className="h-5 w-5 text-[#199ce0]" />
              </button>
              <button
                type="button"
                onClick={handleNextDestination}
                disabled={safeDestinationIndex >= maxDestinationIndex}
                className="h-10 w-10 rounded-full border border-gray-300 bg-white disabled:opacity-40 flex items-center justify-center"
                aria-label="Next destinations"
              >
                <ChevronRight className="h-5 w-5 text-[#199ce0]" />
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
                const resolved = resolveDestinationMeta({
                  name: d.name,
                  country: d.country,
                  tagline: d.tagline,
                  cities: d.cities,
                });
                const country = resolved.country;
                const hasCities = resolved.cities.length > 0;
                const detailLabel = hasCities ? "Cities" : "Tagline";
                const detailValue = hasCities
                  ? resolved.cities.join(", ")
                  : resolved.tagline;
                const destinationSlug = toSlug(country);

                return (
                  <div
                    key={`home-destination-${d.id}`}
                    className="px-2 md:px-3 shrink-0"
                    style={{ width: `${100 / cardsPerView}%` }}
                  >
                    <Link href={`/destinations/${destinationSlug}`} className="block">
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
                            <span className="font-semibold">{detailLabel}:</span> {detailValue}
                          </p>
                          <span className="text-blue-600 font-medium hover:text-blue-700 text-lg md:text-base">
                            View Packages &rarr;
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {maxDestinationIndex > 0 && (
            <div className="mt-3 flex justify-center gap-2">
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
      <section id="packages" className="max-w-7xl mx-auto px-4 py-7 md:py-8">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <h2 className="text-4xl font-bold">Popular Packages</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevPackage}
              disabled={safePackageIndex === 0}
              className="h-10 w-10 rounded-full border border-gray-300 bg-white disabled:opacity-40 flex items-center justify-center"
              aria-label="Previous packages"
            >
              <ChevronLeft className="h-5 w-5 text-[#199ce0]" />
            </button>
            <button
              type="button"
              onClick={handleNextPackage}
              disabled={safePackageIndex >= maxPackageIndex}
              className="h-10 w-10 rounded-full border border-gray-300 bg-white disabled:opacity-40 flex items-center justify-center"
              aria-label="Next packages"
            >
              <ChevronRight className="h-5 w-5 text-[#199ce0]" />
            </button>
          </div>
        </div>
        <div className="text-left mb-5">
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
          <div className="mt-3 flex justify-center gap-2">
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

        <div className="text-center mt-2">
          <Link
            href="/holidays"
            className="inline-flex items-center justify-center bg-[#199ce0] hover:opacity-90 text-white px-8 py-3 rounded-full font-semibold"
          >
            View All Packages
          </Link>
        </div>
      </section>

      {/* ================= CONTACT + EMAIL SIGNUP ================= */}
      <section className="py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-3xl font-bold mb-3">Contact Us</h2>
              <p className="text-gray-600 mb-6">
                Speak with our travel expert for customized packages, visa support, and best offers.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-[#199ce0] text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
                >
                  Open Contact Page
                </Link>
                <a
                  href="tel:+919958839319"
                  className="inline-flex items-center justify-center border border-gray-300 px-5 py-2.5 rounded-full font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Call +91 99588 39319
                </a>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-3xl font-bold mb-3">Email Signup</h2>
              <p className="text-gray-600 mb-6">
                Get destination updates, travel tips, and special package deals directly in your inbox.
              </p>
              <form className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-gray-800"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center bg-[#f5991c] text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRAVEL TIPS ================= */}
      <section className="py-10 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-5">
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

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className="p-4">
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
      <section className="bg-blue-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-4xl font-bold mb-3">Customer Reviews</h2>
              <p className="text-blue-100">Read client experiences and feedback.</p>
            </div>
            <Link href="/customer-reviews" className="font-semibold text-white underline">
              View All Reviews
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
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
    </div>
  );
}



