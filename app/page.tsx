"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  destinations as seedDestinations,
  testimonials,
} from "@/data/mockData";

import { holidays } from "@/data/holidays";
import { travelTips as seedTravelTips } from "@/data/travelTips";
import {
  offers as offerCatalog,
  offerCategoryMeta,
} from "@/data/offers";
import HolidayCard from "@/components/HolidayCard";

import {
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  BedSingle,
  Plane,
  Package,
  Map,
  MapPin,
  CalendarDays,
  Users,
  TrainFront,
  CarFront,
  Bus,
  FileText,
  Banknote,
  Ship,
  ShieldCheck,
} from "lucide-react";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDateDDMMYYYY(value: string): string {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatDateDraft(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return [dd, mm, yyyy].filter(Boolean).join("/");
}

function parseDDMMYYYYToISO(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

const AIRPORT_CODE_MAP: Record<string, string> = {
  delhi: "DEL",
  mumbai: "BOM",
  bangalore: "BLR",
  bengaluru: "BLR",
  chennai: "MAA",
  kolkata: "CCU",
  hyderabad: "HYD",
  dubai: "DXB",
  "abu dhabi": "AUH",
  sharjah: "SHJ",
  singapore: "SIN",
  "kuala lumpur": "KUL",
  langkawi: "LGK",
  penang: "PEN",
  tokyo: "HND",
  osaka: "KIX",
  kyoto: "UKY",
  hanoi: "HAN",
  "ho chi minh city": "SGN",
  danang: "DAD",
  bangkok: "BKK",
  phuket: "HKT",
  krabi: "KBV",
  seoul: "ICN",
  busan: "PUS",
  istanbul: "IST",
  antalya: "AYT",
  sydney: "SYD",
  melbourne: "MEL",
  cairns: "CNS",
  "port louis": "MRU",
};

function withAirportCode(value: string): string {
  const code = AIRPORT_CODE_MAP[value.toLowerCase().trim()];
  return code ? `${value} (${code})` : value;
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

const MASTER_DESTINATION_COUNTRY: Record<string, string> = {
  japan: "Japan",
  "united arab emirates": "United Arab Emirates",
  indonesia: "Indonesia",
  singapore: "Singapore",
  malaysia: "Malaysia",
  vietnam: "Vietnam",
  thailand: "Thailand",
  "south korea": "South Korea",
  india: "India",
  australia: "Australia",
  turkey: "Turkey",
  mauritius: "Mauritius",
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
  const rawCountry = input.country ?? input.name;
  const normalizedCountryKey = normalizeDestinationKey(rawCountry);
  const country =
    MASTER_DESTINATION_COUNTRY[normalizedCountryKey] ?? rawCountry;
  const master = MASTER_DESTINATION_META[normalizedCountryKey];

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
    (sanitizedCities.length > 0
      ? sanitizedCities
      : fallbackCitiesForDestination(country));

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
  const [destinations, setDestinations] = useState(seedDestinations.slice(0, 12));
  const [travelTips, setTravelTips] = useState(seedTravelTips);
  const [cardsPerView, setCardsPerView] = useState(4);
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [packageCardsPerView, setPackageCardsPerView] = useState(4);
  const [packageIndex, setPackageIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [activeSearchTab, setActiveSearchTab] = useState("flights");
  const [searchDestination, setSearchDestination] = useState("");
  const [searchFrom, setSearchFrom] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [tripType, setTripType] = useState("oneway");
  const [cabinClass, setCabinClass] = useState("Economy");
  const [includeFlight, setIncludeFlight] = useState(false);
  const [includeStay, setIncludeStay] = useState(true);
  const [showDestinationMenu, setShowDestinationMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTravelerPicker, setShowTravelerPicker] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState("");
  const [endDateDraft, setEndDateDraft] = useState("");
  const departureDatePickerRef = useRef<HTMLInputElement | null>(null);
  const returnDatePickerRef = useRef<HTMLInputElement | null>(null);

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
          setDestinations(data.destinations.slice(0, 12));
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
  const homeOfferCards = offerCatalog.slice(0, 4);
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
    const items: { label: string; query: string }[] = [];
    const seen = new Set<string>();
    function pushValue(value: string) {
      const normalized = value.trim();
      if (!normalized) return;
      const label = withAirportCode(normalized);
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        label,
        query: `${normalized.toLowerCase()} ${label.toLowerCase()}`,
      });
    }
    destinations.forEach((d) => {
      if (Array.isArray(d.cities)) {
        d.cities.forEach(pushValue);
        if (d.cities.length > 0) return;
      }
      const country = d.country ?? d.name;
      pushValue(country);
    });
    const query = searchDestination.trim().toLowerCase();
    if (!query) return items.slice(0, 8);
    return items
      .filter((item) => item.query.includes(query))
      .slice(0, 8);
  }, [destinations, searchDestination]);

  const totalTravelers = adults + children + infants;
  const travelerSummary = `${totalTravelers} travelers, ${rooms} room${
    rooms > 1 ? "s" : ""
  }`;

  const widgetInputShellClass =
    "h-12 rounded-xl border border-slate-200 bg-white/95 px-4 inline-flex items-center gap-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition hover:border-[#199ce0]/45 focus-within:border-[#199ce0] focus-within:ring-2 focus-within:ring-[#199ce0]/20";
  const widgetPopoverClass =
    "absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_16px_36px_rgba(15,23,42,0.22)] max-h-72 overflow-auto z-[120]";
  const widgetSubmitClass =
    "h-12 rounded-xl bg-gradient-to-r from-[#199ce0] to-[#0e86c4] text-white font-semibold inline-flex items-center justify-center gap-2 shadow-[0_10px_22px_rgba(25,156,224,0.38)] hover:opacity-95";
  const widgetDoneButtonClass =
    "bg-[#199ce0] text-white px-4 py-2 rounded-full font-semibold hover:opacity-95";
  const premiumPanelClass =
    "overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm";
  const widgetColumnClass =
    "px-4 py-3 transition-colors duration-150 hover:bg-[#f4faff] focus-within:bg-[#f4faff]";
  const premiumSearchButtonClass =
    "h-12 min-w-[190px] rounded-full bg-gradient-to-r from-[#45afff] to-[#1274f3] px-7 text-lg font-bold text-white shadow-[0_12px_28px_rgba(18,116,243,0.32)]";
  const widgetTabs = [
    { id: "flights", label: "Flights", icon: Plane },
    { id: "stays", label: "Stays", icon: BedSingle },
    { id: "things", label: "Attractions", icon: Map },
    { id: "packages", label: "Holidays", icon: Package },
    { id: "trains", label: "Trains", icon: TrainFront },
    { id: "cabs", label: "Cabs", icon: CarFront },
    { id: "bus", label: "Bus", icon: Bus },
    { id: "visa", label: "Visa", icon: FileText },
    { id: "forex", label: "Forex", icon: Banknote },
    { id: "cruise", label: "Cruise", icon: Ship },
    { id: "insurance", label: "Insurance", icon: ShieldCheck },
  ];
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
      )}&date=${encodeURIComponent(date)}&adults=${adults}&children=${children}&infants=${infants}&cabinClass=${encodeURIComponent(cabinClass)}&tripType=${encodeURIComponent(tripType)}`;
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
      target = `/things-to-do?destination=${encodeURIComponent(destination)}`;
    }

    if (activeSearchTab === "trains") {
      target = `/trains?from=${encodeURIComponent(
        searchFrom || "Delhi"
      )}&to=${encodeURIComponent(searchTo || destination)}&date=${encodeURIComponent(
        startDate
      )}`;
    }

    if (activeSearchTab === "cabs") {
      target = `/cabs?airport=${encodeURIComponent(
        searchFrom || "DXB"
      )}&city=${encodeURIComponent(searchTo || destination)}&date=${encodeURIComponent(
        startDate
      )}&passengers=${totalTravelers}`;
    }

    if (activeSearchTab === "bus") {
      target = `/bus?from=${encodeURIComponent(
        searchFrom || "Delhi"
      )}&to=${encodeURIComponent(searchTo || destination)}&date=${encodeURIComponent(
        startDate
      )}`;
    }

    if (activeSearchTab === "visa") {
      target = `/visa?destination=${encodeURIComponent(
        searchDestination || destination
      )}&date=${encodeURIComponent(startDate)}`;
    }

    if (activeSearchTab === "forex") {
      target = `/forex?destination=${encodeURIComponent(
        searchDestination || destination
      )}`;
    }

    if (activeSearchTab === "cruise") {
      target = `/cruise?destination=${encodeURIComponent(
        searchDestination || destination
      )}&date=${encodeURIComponent(startDate)}`;
    }

    if (activeSearchTab === "insurance") {
      target = `/insurance?destination=${encodeURIComponent(
        searchDestination || destination
      )}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(
        endDate
      )}&travelers=${totalTravelers}`;
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
      {/* ================= HERO ================= */}
      <section className="bg-gradient-to-b from-white to-slate-50 pt-3 pb-8 md:pb-10">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-4">
          <div className="flex flex-col-reverse gap-4">
          <div className="relative rounded-[28px] overflow-visible border border-slate-200 min-h-[500px] md:min-h-[560px] shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
            <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-slate-950">
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
                    quality={85}
                    priority={i === safeHeroIndex}

                    sizes="100vw"
                  />
                </div>
              ))}
              <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/40 to-[#199ce0]/35" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,153,28,0.32),transparent_42%),radial-gradient(circle_at_82%_65%,rgba(25,156,224,0.26),transparent_42%)]" />
            </div>

            <Link
              href={`/destinations/${activeHeroSlide.slug}`}
              className="absolute inset-0 z-10"
              aria-label={`Open ${activeHeroSlide.name} destination`}
            />

            <div className="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-6 px-5 md:px-8 lg:px-10 pt-8 md:pt-10">
              <div className="lg:col-span-8 pointer-events-none text-white max-w-3xl">
                <span className="inline-flex items-center rounded-full border border-white/45 bg-white/10 px-4 py-1 text-[11px] md:text-xs font-semibold tracking-[0.16em] uppercase">
                  Featured Destination
                </span>
                <h1 className="mt-4 text-4xl md:text-6xl font-semibold leading-[1.06] drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                  {activeHeroSlide.name}
                </h1>
                <p className="mt-3 text-lg md:text-2xl text-white/95 leading-snug">
                  {activeHeroSlide.tagline}
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {(activeHeroSlide.cities.length > 0
                    ? activeHeroSlide.cities
                    : ["Curated city experiences"]
                  ).map((city, index) => (
                    <span
                      key={`hero-city-${city}-${index}`}
                      className="rounded-full border border-white/45 bg-white/12 px-4 py-1.5 text-sm md:text-base text-white/95"
                    >
                      {city}
                    </span>
                  ))}
                </div>
              </div>

              <div className="hidden lg:block lg:col-span-4 pointer-events-none">
                <div className="ml-auto mt-2 max-w-sm rounded-2xl border border-white/35 bg-white/12 p-5 text-white backdrop-blur-md shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                  <p className="text-sm tracking-[0.14em] uppercase text-white/80">Plan Snapshot</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3 text-white/95">
                      <MapPin className="h-4 w-4 text-[#f5991c]" />
                      <span className="text-sm font-medium">Top pick: {activeHeroSlide.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/95">
                      <CalendarDays className="h-4 w-4 text-[#f5991c]" />
                      <span className="text-sm font-medium">Best months: Oct to Mar</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/95">
                      <Users className="h-4 w-4 text-[#f5991c]" />
                      <span className="text-sm font-medium">Great for couples and families</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute left-4 md:left-7 lg:left-9 bottom-4 md:bottom-5 z-30 flex justify-center gap-2">
              {heroSlides.map((slide, i) => (
                <button
                  key={`hero-dot-${slide.slug}-${i}`}
                  type="button"
                  onClick={() => setHeroIndex(i)}
                  className={`h-2.5 rounded-full transition-all ${
                    i === safeHeroIndex ? "w-8 bg-white" : "w-2.5 bg-white/65"
                  }`}
                  aria-label={`Go to hero slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

            <div className="sticky top-[72px] z-40 mx-auto w-full max-w-[1140px]">
              <div
                id="home-booking-engine-widget"
                className="overflow-visible rounded-[20px] border border-white/70 bg-white/92 backdrop-blur-xl shadow-[0_18px_44px_rgba(15,23,42,0.26)]"
              >
                <div className="bg-gradient-to-r from-white to-slate-50/70 px-3.5 pt-2.5 md:px-5">
                  <div className="-mx-1 overflow-x-auto border-b border-slate-200 pb-1.5 md:mx-0 md:overflow-visible">
                    <div className="inline-flex min-w-max items-end gap-0 px-1 md:mx-auto md:flex md:min-w-0 md:justify-center md:px-0">
                      {widgetTabs.map((item) => {
                        const Icon = item.icon;
                        const active = activeSearchTab === item.id;
                        const attractionHolidayGapClass =
                          item.id === "things"
                            ? "md:mr-1"
                            : item.id === "packages"
                            ? "md:ml-1"
                            : "";
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              handleSearchTabChange(item.id);
                            }}
                            className={`group relative flex h-[54px] w-[74px] shrink-0 flex-col items-center justify-start gap-0.5 rounded-md px-0.5 py-1 text-[11.5px] md:h-[52px] md:w-[74px] md:max-w-[74px] md:text-[12px] font-medium leading-[11px] transition ${attractionHolidayGapClass} ${
                              active
                                ? "text-[#199ce0]"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            <span className="inline-flex h-[24px] w-[24px] items-center justify-center">
                              <Icon
                                className={`h-[22px] w-[22px] md:h-[23px] md:w-[23px] ${
                                  active ? "text-[#199ce0]" : "text-slate-500 group-hover:text-slate-700"
                                }`}
                              />
                            </span>
                            <span className="inline-flex h-[24px] w-full items-start justify-center text-center whitespace-nowrap">
                              {item.label}
                            </span>
                            <span
                              className={`absolute -bottom-1.5 left-1.5 right-1.5 h-0.5 rounded-full transition ${
                                active ? "bg-[#199ce0]" : "bg-transparent group-hover:bg-slate-300"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleSearchSubmit}
                  className="bg-[linear-gradient(180deg,#ffffff,rgba(241,245,249,0.75))] p-2.5 md:p-3.5"
                >
  <datalist id="airport-city-suggestions">
    {destinationSuggestions.map((item) => (
      <option key={`list-${item.label}`} value={item.label} />
    ))}
  </datalist>
  {activeSearchTab === "stays" && (
    <>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-slate-600">
          Find hotels, homestays, villas, and apartments.
        </p>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {travelerSummary}
        </span>
      </div>

      <div className={premiumPanelClass}>
        <div className="grid grid-cols-1 md:grid-cols-[1.45fr_1fr_1fr_1.15fr]">
          <div className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">Destination</p>
            <label className="mt-1 inline-flex w-full items-center gap-2">
              <MapPin className="h-5 w-5 shrink-0 text-[#199ce0]" />
              <input
                type="text"
                value={searchDestination}
                onChange={(e) => setSearchDestination(e.target.value)}
                list="airport-city-suggestions"
                onFocus={() => {
                  setShowDestinationMenu(true);
                  setShowDatePicker(false);
                  setShowTravelerPicker(false);
                }}
                placeholder="Where to?"
                className="w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">City, area, or landmark</p>
            {showDestinationMenu && (
              <div className={widgetPopoverClass}>
                {destinationSuggestions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setSearchDestination(item.label);
                      setShowDestinationMenu(false);
                    }}
                    className="w-full bg-white text-left px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                  >
                    <div className="font-semibold text-slate-900">{item.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowDatePicker((prev) => !prev);
              setShowDestinationMenu(false);
              setShowTravelerPicker(false);
            }}
            className={`relative border-b border-slate-200 ${widgetColumnClass} text-left md:border-b-0 md:border-r`}
          >
            <p className="text-sm font-medium text-slate-500">Check-in</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {startDate ? formatDateDDMMYYYY(startDate) : "DD/MM/YYYY"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Select start date</p>
            {showDatePicker && (
              <div className={`${widgetPopoverClass} right-auto w-[min(95vw,460px)] p-4`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600">Check-in</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      lang="en-GB"
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Check-out</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      lang="en-GB"
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowDatePicker((prev) => !prev);
              setShowDestinationMenu(false);
              setShowTravelerPicker(false);
            }}
            className={`border-b border-slate-200 ${widgetColumnClass} text-left md:border-b-0 md:border-r`}
          >
            <p className="text-sm font-medium text-slate-500">Check-out</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {endDate ? formatDateDDMMYYYY(endDate) : "DD/MM/YYYY"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Select end date</p>
          </button>

          <div className="relative px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setShowTravelerPicker((prev) => !prev);
                setShowDatePicker(false);
                setShowDestinationMenu(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Guests & Rooms</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{travelerSummary}</p>
              <p className="mt-1 text-xs text-slate-500">Customize your stay</p>
            </button>
            {showTravelerPicker && (
              <div className={`${widgetPopoverClass} right-0 left-auto w-[min(95vw,360px)] p-4`}>
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
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeFlight}
            onChange={(e) => setIncludeFlight(e.target.checked)}
          />
          Add a flight to bundle and save
        </label>
      </div>
      <div className="mt-4 flex justify-center">
        <button type="submit" className={premiumSearchButtonClass}>
          SEARCH STAYS
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "flights" && (
    <>
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex flex-wrap items-center gap-5">
          {["roundtrip", "oneway"].map((type) => {
            const checked = tripType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTripType(type)}
                className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-700"
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full border transition ${
                    checked ? "border-[#199ce0]" : "border-slate-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition ${
                      checked ? "bg-[#199ce0]" : "bg-transparent"
                    }`}
                  />
                </span>
                {type === "roundtrip"
                  ? "Roundtrip"
                  : "One-way"}
              </button>
            );
          })}
        </div>
        <p className="text-sm font-medium text-slate-600">
          Book international and domestic flights
        </p>
      </div>

      <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1.25fr_1fr_1fr_1.2fr]">
          <label className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">From</p>
            <input
              type="text"
              value={searchFrom}
              onChange={(e) => setSearchFrom(e.target.value)}
              list="airport-city-suggestions"
              placeholder="New Delhi"
              className="mt-1 w-full bg-transparent text-3xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">City or airport</p>
          </label>

          <label className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">To</p>
            <input
              type="text"
              value={searchTo}
              onChange={(e) => setSearchTo(e.target.value)}
              list="airport-city-suggestions"
              placeholder="Bengaluru"
              className="mt-1 w-full bg-transparent text-3xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">City or airport</p>
            <button
              type="button"
              onClick={() => {
                const from = searchFrom;
                setSearchFrom(searchTo);
                setSearchTo(from);
              }}
              className="absolute -left-3 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm md:inline-flex"
              aria-label="Swap source and destination"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          </label>

          <div className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <button
              type="button"
              onClick={() => {
                setStartDateDraft(startDate ? formatDateDDMMYYYY(startDate) : "");
                setEndDateDraft(endDate ? formatDateDDMMYYYY(endDate) : "");
                setShowDatePicker((prev) => !prev);
                setShowTravelerPicker(false);
                setShowDestinationMenu(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Departure</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {startDate ? formatDateDDMMYYYY(startDate) : "DD/MM/YYYY"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {startDate ? "Selected departure date" : "Tap to pick departure"}
              </p>
            </button>
            {showDatePicker && (
              <div className={`${widgetPopoverClass} right-auto w-[min(95vw,460px)] p-4`}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-gray-600">Departure</label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={startDateDraft}
                        onChange={(e) => {
                          const formatted = formatDateDraft(e.target.value);
                          setStartDateDraft(formatted);
                          if (!formatted) {
                            setStartDate("");
                            return;
                          }
                          const iso = parseDDMMYYYYToISO(formatted);
                          if (iso) setStartDate(iso);
                        }}
                        placeholder="DD/MM/YYYY"
                        className="w-full rounded-lg border px-3 py-2 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = departureDatePickerRef.current as
                            | (HTMLInputElement & { showPicker?: () => void })
                            | null;
                          if (!input) return;
                          if (input.showPicker) {
                            input.showPicker();
                          } else {
                            input.focus();
                            input.click();
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        aria-label="Open departure calendar"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                      <input
                        ref={departureDatePickerRef}
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setStartDateDraft(
                            e.target.value ? formatDateDDMMYYYY(e.target.value) : ""
                          );
                        }}
                        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Return</label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={endDateDraft}
                        onChange={(e) => {
                          const formatted = formatDateDraft(e.target.value);
                          setEndDateDraft(formatted);
                          if (!formatted) {
                            setEndDate("");
                            return;
                          }
                          const iso = parseDDMMYYYYToISO(formatted);
                          if (iso) setEndDate(iso);
                        }}
                        placeholder="DD/MM/YYYY"
                        className="w-full rounded-lg border px-3 py-2 pr-10"
                        disabled={tripType !== "roundtrip"}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (tripType !== "roundtrip") return;
                          const input = returnDatePickerRef.current as
                            | (HTMLInputElement & { showPicker?: () => void })
                            | null;
                          if (!input) return;
                          if (input.showPicker) {
                            input.showPicker();
                          } else {
                            input.focus();
                            input.click();
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        aria-label="Open return calendar"
                        disabled={tripType !== "roundtrip"}
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                      <input
                        ref={returnDatePickerRef}
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setEndDateDraft(
                            e.target.value ? formatDateDDMMYYYY(e.target.value) : ""
                          );
                        }}
                        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
                        tabIndex={-1}
                        aria-hidden="true"
                        disabled={tripType !== "roundtrip"}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (tripType === "roundtrip") {
                setStartDateDraft(startDate ? formatDateDDMMYYYY(startDate) : "");
                setEndDateDraft(endDate ? formatDateDDMMYYYY(endDate) : "");
                setShowDatePicker(true);
                setShowTravelerPicker(false);
                setShowDestinationMenu(false);
              }
            }}
            className={`border-b border-slate-200 ${widgetColumnClass} text-left md:border-b-0 md:border-r disabled:cursor-not-allowed`}
            disabled={tripType !== "roundtrip"}
          >
            <p className="text-sm font-medium text-slate-500">Return</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {tripType === "roundtrip"
                ? endDate
                  ? formatDateDDMMYYYY(endDate)
                  : "DD/MM/YYYY"
                : "--/--/----"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {tripType === "roundtrip" ? "Tap to add return date" : "Return not required"}
            </p>
          </button>

          <div className="relative px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setShowTravelerPicker((prev) => !prev);
                setShowDatePicker(false);
                setShowDestinationMenu(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Travellers & Class</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {totalTravelers} Traveller{totalTravelers > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">{cabinClass}</p>
            </button>
            {showTravelerPicker && (
              <div className={`${widgetPopoverClass} right-0 left-auto w-[min(95vw,360px)] p-4`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Adults</p>
                      <p className="text-xs text-gray-500">12Y+</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setAdults((prev) => {
                            const next = Math.max(prev - 1, 1);
                            setInfants((current) => Math.min(current, next));
                            return next;
                          })
                        }
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
                      <p className="text-xs text-gray-500">2Y - 12Y</p>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Infant</p>
                      <p className="text-xs text-gray-500">Below 2Y</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setInfants((prev) => Math.max(prev - 1, 0))}
                        className="h-8 w-8 rounded-full border"
                      >
                        -
                      </button>
                      <span className="font-semibold">{infants}</span>
                      <button
                        type="button"
                        onClick={() => setInfants((prev) => Math.min(prev + 1, adults))}
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
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    >
                      <option>Economy</option>
                      <option>Premium Economy</option>
                      <option>Business</option>
                      <option>First</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowTravelerPicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button type="submit" className={premiumSearchButtonClass}>
          SEARCH FLIGHTS
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "packages" && (
    <>
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                chip.active
                  ? "border-[#199ce0] bg-[#199ce0]/12 text-[#199ce0]"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              {chip.label}
            </button>
          ))}
          <select
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            <option>Economy</option>
            <option>Premium Economy</option>
            <option>Business</option>
            <option>First</option>
          </select>
        </div>
        <p className="text-sm font-medium text-slate-600">
          Build a complete holiday bundle in one search.
        </p>
      </div>

      <div className={premiumPanelClass}>
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_1fr_1.15fr]">
          <label className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">Leaving from</p>
            <input
              type="text"
              value={searchFrom}
              onChange={(e) => setSearchFrom(e.target.value)}
              list="airport-city-suggestions"
              placeholder="New Delhi"
              className="mt-1 w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">Origin city or airport</p>
          </label>

          <label className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">Going to</p>
            <input
              type="text"
              value={searchTo}
              onChange={(e) => setSearchTo(e.target.value)}
              list="airport-city-suggestions"
              placeholder="Dubai"
              className="mt-1 w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">Destination city</p>
            <button
              type="button"
              onClick={() => {
                const from = searchFrom;
                setSearchFrom(searchTo);
                setSearchTo(from);
              }}
              className="absolute -left-3 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm md:inline-flex"
              aria-label="Swap source and destination"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          </label>

          <div className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <button
              type="button"
              onClick={() => {
                setShowDatePicker((prev) => !prev);
                setShowDestinationMenu(false);
                setShowTravelerPicker(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Travel dates</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {startDate ? formatDateDDMMYYYY(startDate) : "DD/MM/YYYY"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {endDate ? `to ${formatDateDDMMYYYY(endDate)}` : "Select package dates"}
              </p>
            </button>
            {showDatePicker && (
              <div className={`${widgetPopoverClass} right-auto w-[min(95vw,460px)] p-4`}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-gray-600">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      lang="en-GB"
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      lang="en-GB"
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setShowTravelerPicker((prev) => !prev);
                setShowDatePicker(false);
                setShowDestinationMenu(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Travellers</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{travelerSummary}</p>
              <p className="mt-1 text-xs text-slate-500">{cabinClass}</p>
            </button>
            {showTravelerPicker && (
              <div className={`${widgetPopoverClass} left-auto right-0 w-[min(95vw,360px)] p-4`}>
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
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowTravelerPicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <label className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" />
        I only need accommodation for part of my trip
      </label>

      <div className="mt-4 flex justify-center">
        <button type="submit" className={premiumSearchButtonClass}>
          SEARCH HOLIDAYS
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "things" && (
    <>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-slate-600">
          Discover curated attractions, events, and local experiences.
        </p>
        <span className="text-xs font-semibold text-[#199ce0]">
          Search event tickets
        </span>
      </div>

      <div className={premiumPanelClass}>
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">Going to</p>
            <label className="mt-1 inline-flex w-full items-center gap-2">
              <MapPin className="h-5 w-5 shrink-0 text-[#199ce0]" />
              <input
                type="text"
                value={searchDestination}
                onChange={(e) => setSearchDestination(e.target.value)}
                list="airport-city-suggestions"
                onFocus={() => {
                  setShowDestinationMenu(true);
                  setShowDatePicker(false);
                  setShowTravelerPicker(false);
                }}
                placeholder="City or attraction"
                className="w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">Find activities near your destination</p>
            {showDestinationMenu && (
              <div className={widgetPopoverClass}>
                {destinationSuggestions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setSearchDestination(item.label);
                      setShowDestinationMenu(false);
                    }}
                    className="w-full border-b border-slate-100 bg-white px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                  >
                    <div className="font-semibold text-slate-900">{item.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <button
              type="button"
              onClick={() => {
                setShowDatePicker((prev) => !prev);
                setShowDestinationMenu(false);
                setShowTravelerPicker(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Date</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {startDate ? formatDateDDMMYYYY(startDate) : "DD/MM/YYYY"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Pick your activity date</p>
            </button>
            {showDatePicker && (
              <div className={`${widgetPopoverClass} right-auto w-[min(95vw,360px)] p-4`}>
                <label className="text-sm text-gray-600">Activity date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  lang="en-GB"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="px-4 py-3">
            <p className="text-sm font-medium text-slate-500">Guests</p>
            <div className="mt-1 inline-flex w-full items-center gap-2">
              <Users className="h-5 w-5 shrink-0 text-[#199ce0]" />
              <input
                type="number"
                min={1}
                max={9}
                value={totalTravelers}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(9, Number(e.target.value) || 1));
                  setAdults(value);
                  setChildren(0);
                  setInfants(0);
                }}
                className="w-full bg-transparent text-xl font-semibold text-slate-900 outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Total travelers for booking</p>
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button type="submit" className={premiumSearchButtonClass}>
          SEARCH ATTRACTIONS
        </button>
      </div>
    </>
  )}

  {(activeSearchTab === "trains" || activeSearchTab === "bus") && (
    <>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-slate-600">
          {activeSearchTab === "trains"
            ? "Search intercity train routes and timings."
            : "Search bus routes and seat availability."}
        </p>
        <span className="text-xs font-semibold text-slate-500">
          {activeSearchTab === "trains" ? "Rail bookings" : "Bus bookings"}
        </span>
      </div>

      <div className={premiumPanelClass}>
        <div className="grid grid-cols-1 md:grid-cols-[1.35fr_1.35fr_1fr_1fr]">
          <label className={`border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">
              {activeSearchTab === "trains" ? "Leaving from" : "From city"}
            </p>
            <input
              type="text"
              value={searchFrom}
              onChange={(e) => setSearchFrom(e.target.value)}
              list="airport-city-suggestions"
              placeholder={activeSearchTab === "trains" ? "New Delhi" : "Delhi"}
              className="mt-1 w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">Source station / city</p>
          </label>

          <label className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">
              {activeSearchTab === "trains" ? "Going to" : "To city"}
            </p>
            <input
              type="text"
              value={searchTo}
              onChange={(e) => setSearchTo(e.target.value)}
              list="airport-city-suggestions"
              placeholder={activeSearchTab === "trains" ? "Mumbai" : "Jaipur"}
              className="mt-1 w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">Destination station / city</p>
            <button
              type="button"
              onClick={() => {
                const from = searchFrom;
                setSearchFrom(searchTo);
                setSearchTo(from);
              }}
              className="absolute -left-3 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm md:inline-flex"
              aria-label="Swap source and destination"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          </label>

          <div className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <button
              type="button"
              onClick={() => {
                setShowDatePicker((prev) => !prev);
                setShowDestinationMenu(false);
                setShowTravelerPicker(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Travel date</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {startDate ? formatDateDDMMYYYY(startDate) : "DD/MM/YYYY"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Choose departure date</p>
            </button>
            {showDatePicker && (
              <div className={`${widgetPopoverClass} right-auto w-[min(95vw,360px)] p-4`}>
                <label className="text-sm text-gray-600">Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  lang="en-GB"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="px-4 py-3">
            <p className="text-sm font-medium text-slate-500">Passengers</p>
            <div className="mt-1 inline-flex w-full items-center gap-2">
              <Users className="h-5 w-5 shrink-0 text-[#199ce0]" />
              <input
                type="number"
                min={1}
                max={9}
                value={totalTravelers}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(9, Number(e.target.value) || 1));
                  setAdults(value);
                  setChildren(0);
                  setInfants(0);
                }}
                className="w-full bg-transparent text-xl font-semibold text-slate-900 outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Total travelers</p>
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button type="submit" className={premiumSearchButtonClass}>
          {activeSearchTab === "trains" ? "SEARCH TRAINS" : "SEARCH BUS"}
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "cabs" && (
    <>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-slate-600">
          Book airport transfers and city rides with transparent fares.
        </p>
        <span className="text-xs font-semibold text-slate-500">Airport and intercity cabs</span>
      </div>

      <div className={premiumPanelClass}>
        <div className="grid grid-cols-1 md:grid-cols-[1.25fr_1.25fr_1fr_0.9fr]">
          <label className={`border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">Pickup</p>
            <input
              type="text"
              value={searchFrom}
              onChange={(e) => setSearchFrom(e.target.value)}
              list="airport-city-suggestions"
              placeholder="Pickup airport/city"
              className="mt-1 w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">Airport, hotel, or city point</p>
          </label>

          <label className={`border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <p className="text-sm font-medium text-slate-500">Drop-off</p>
            <input
              type="text"
              value={searchTo}
              onChange={(e) => setSearchTo(e.target.value)}
              list="airport-city-suggestions"
              placeholder="Drop location"
              className="mt-1 w-full bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
            <p className="mt-1 text-xs text-slate-500">Final destination</p>
          </label>

          <div className={`relative border-b border-slate-200 ${widgetColumnClass} md:border-b-0 md:border-r`}>
            <button
              type="button"
              onClick={() => {
                setShowDatePicker((prev) => !prev);
                setShowDestinationMenu(false);
                setShowTravelerPicker(false);
              }}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-slate-500">Pickup date</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {startDate ? formatDateDDMMYYYY(startDate) : "DD/MM/YYYY"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Choose your travel date</p>
            </button>
            {showDatePicker && (
              <div className={`${widgetPopoverClass} right-auto w-[min(95vw,360px)] p-4`}>
                <label className="text-sm text-gray-600">Pickup date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  lang="en-GB"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className={widgetDoneButtonClass}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="px-4 py-3">
            <p className="text-sm font-medium text-slate-500">Passengers</p>
            <div className="mt-1 inline-flex w-full items-center gap-2">
              <Users className="h-5 w-5 shrink-0 text-[#199ce0]" />
              <input
                type="number"
                min={1}
                max={9}
                value={totalTravelers}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(9, Number(e.target.value) || 1));
                  setAdults(value);
                  setChildren(0);
                  setInfants(0);
                }}
                className="w-full bg-transparent text-xl font-semibold text-slate-900 outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Total travelers</p>
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button type="submit" className={premiumSearchButtonClass}>
          SEARCH CABS
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "visa" && (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <label className={`md:col-span-6 ${widgetInputShellClass}`}>
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchDestination}
            onChange={(e) => setSearchDestination(e.target.value)}
            placeholder="Destination country"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className={`md:col-span-5 ${widgetInputShellClass}`}>
          <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            lang="en-GB"
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <button type="submit" className={`md:col-span-1 ${widgetSubmitClass}`}>
          Search
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "forex" && (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <label className={`md:col-span-8 ${widgetInputShellClass}`}>
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchDestination}
            onChange={(e) => setSearchDestination(e.target.value)}
            placeholder="Travel destination"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className={`md:col-span-3 ${widgetInputShellClass}`}>
          <Banknote className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="number"
            min={100}
            step={100}
            placeholder="Amount"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <button type="submit" className={`md:col-span-1 ${widgetSubmitClass}`}>
          Search
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "cruise" && (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <label className={`md:col-span-5 ${widgetInputShellClass}`}>
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchDestination}
            onChange={(e) => setSearchDestination(e.target.value)}
            placeholder="Cruise destination"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className={`md:col-span-4 ${widgetInputShellClass}`}>
          <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            lang="en-GB"
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <label className={`md:col-span-2 ${widgetInputShellClass}`}>
          <Users className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="number"
            min={1}
            max={9}
            value={totalTravelers}
            onChange={(e) => {
              const value = Math.max(1, Math.min(9, Number(e.target.value) || 1));
              setAdults(value);
              setChildren(0);
              setInfants(0);
            }}
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <button type="submit" className={`md:col-span-1 ${widgetSubmitClass}`}>
          Search
        </button>
      </div>
    </>
  )}

  {activeSearchTab === "insurance" && (
    <>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <label className={`md:col-span-4 ${widgetInputShellClass}`}>
          <MapPin className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="text"
            value={searchDestination}
            onChange={(e) => setSearchDestination(e.target.value)}
            placeholder="Destination"
            className="w-full bg-transparent outline-none text-gray-700 placeholder:text-gray-500"
          />
        </label>
        <label className={`md:col-span-3 ${widgetInputShellClass}`}>
          <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            lang="en-GB"
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <label className={`md:col-span-3 ${widgetInputShellClass}`}>
          <CalendarDays className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            lang="en-GB"
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <label className={`md:col-span-1 ${widgetInputShellClass}`}>
          <Users className="h-5 w-5 text-[#199ce0] shrink-0" />
          <input
            type="number"
            min={1}
            max={9}
            value={totalTravelers}
            onChange={(e) => {
              const value = Math.max(1, Math.min(9, Number(e.target.value) || 1));
              setAdults(value);
              setChildren(0);
              setInfants(0);
            }}
            className="w-full bg-transparent outline-none text-gray-700"
          />
        </label>
        <button type="submit" className={`md:col-span-1 ${widgetSubmitClass}`}>
          Search
        </button>
      </div>
    </>
  )}
</form>
              </div>
            </div>
          </div>

          <div className="mt-5 md:mt-6 rounded-2xl bg-gradient-to-r from-[#f5991c] via-[#f7a735] to-[#f8b44a] text-white px-5 md:px-8 py-4 md:py-5 shadow-[0_10px_28px_rgba(245,153,28,0.38)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xl md:text-3xl font-semibold">Annual Vacation Sale</p>
                <p className="text-white/90 text-sm md:text-base mt-1">
                  Members save up to 40% on select hotels and holiday bundles.
                </p>
              </div>
              <Link
                href="/holidays"
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/65 bg-white/15 px-6 text-sm font-semibold text-white hover:bg-white/25"
              >
                Explore Deals
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= OFFERS SNAPSHOT ================= */}
      <section className="bg-slate-100 py-6 md:py-7">
        <div className="max-w-7xl mx-auto px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-4xl font-bold text-slate-900">Offers</h2>
                <p className="text-sm md:text-base text-slate-600 mt-1">
                  Live deals across flights, stays, packages, things to do, and more.
                </p>
              </div>
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 text-sm md:text-base font-semibold text-[#199ce0] hover:underline"
              >
                View All &rarr;
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 border-t border-slate-200 pt-4">
              {homeOfferCards.map((offer) => (
                <article
                  key={`home-offer-${offer.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                >
                  <div className="relative h-28">
                    <Image
                      src={offer.image}
                      alt={offer.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      className="object-cover"
                      quality={82}

                    />
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[#199ce0] uppercase tracking-wide">
                        {offerCategoryMeta[offer.category].label}
                      </span>
                      <span className="truncate">{offer.destination}</span>
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold leading-tight text-slate-900 line-clamp-2">
                      {offer.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                      {offer.description}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full bg-[#199ce0]/10 px-2.5 py-1 text-xs font-bold text-[#199ce0]">
                        {offer.code}
                      </span>
                      <Link
                        href={offer.href}
                        className="text-sm font-semibold text-[#199ce0] hover:underline"
                      >
                        Book Now
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= TOP DESTINATIONS ================= */}
      <section className="bg-gray-100 py-5 md:py-6 mt-2">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-5 md:mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
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
                        <div className="relative h-32 md:h-36">
                          <Image
                            src={d.image}
                            alt={d.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover"
                            quality={80}

                          />
                        </div>
                        <div className="p-3.5 md:p-4">
                          <h3 className="text-xl md:text-[22px] font-semibold text-slate-900 mb-1 leading-tight">
                            {country}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            <span className="font-semibold">{detailLabel}:</span> {detailValue}
                          </p>
                          <span className="text-blue-600 font-medium hover:text-blue-700 text-base">
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
      <section id="packages" className="max-w-7xl mx-auto px-4 py-6 md:py-7">
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <h2 className="text-3xl md:text-[34px] font-bold">Popular Packages</h2>
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
      <section className="py-8 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-2xl font-bold mb-3">Contact Us</h2>
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
              <h2 className="text-2xl font-bold mb-3">Email Signup</h2>
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
      <section className="py-8 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-3xl md:text-[34px] font-bold mb-2">Travel Tips & Guides</h2>
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
                <div className="relative h-44">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover"
                    quality={80}

                  />
                </div>
                <div className="p-4">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{post.title}</h3>
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
      <section className="bg-blue-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-3xl md:text-[34px] font-bold mb-2">Customer Reviews</h2>
              <p className="text-blue-100">Read client experiences and feedback.</p>
            </div>
            <Link href="/customer-reviews" className="font-semibold text-white underline">
              View All Reviews
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.map((t) => (
              <div key={t.id} className="bg-white/10 p-5 rounded-2xl">
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




