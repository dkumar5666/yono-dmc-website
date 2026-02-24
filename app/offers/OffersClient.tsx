"use client";

import { type ComponentType, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  BedSingle,
  Bus,
  CarFront,
  Check,
  Copy,
  CreditCard,
  Plane,
  ShieldCheck,
  Ship,
  Ticket,
  TrainFront,
  Wallet,
  X,
} from "lucide-react";
import {
  isOfferCategory,
  offerCategoryMeta,
  offerFilterOrder,
  offers,
  type OfferCategory,
  type OfferFilterKey,
} from "@/data/offers";

const categoryIconMap: Record<OfferCategory, ComponentType<{ className?: string }>> = {
  flights: Plane,
  stays: BedSingle,
  packages: Ticket,
  "things-to-do": Ticket,
  cabs: CarFront,
  trains: TrainFront,
  bus: Bus,
  forex: Wallet,
  cruise: Ship,
  insurance: ShieldCheck,
  visa: CreditCard,
};

const LIVE_DESTINATIONS = [
  "Japan",
  "United Arab Emirates",
  "Indonesia",
  "Singapore",
  "Malaysia",
  "Vietnam",
  "Thailand",
  "South Korea",
  "India",
  "Australia",
  "Turkey",
  "Mauritius",
] as const;

function filterLabel(filter: OfferFilterKey): string {
  if (filter === "all") return "All Offers";
  return offerCategoryMeta[filter].label;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Limited period";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function OffersClient({
  initialCategory,
}: {
  initialCategory?: string;
}) {
  const [activeCategory, setActiveCategory] = useState<OfferFilterKey>(() =>
    isOfferCategory(initialCategory) ? initialCategory : "all"
  );
  const [selectedDestination, setSelectedDestination] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedOfferId, setCopiedOfferId] = useState<string | null>(null);

  const destinationOptions = useMemo(() => {
    const available = new Set(offers.map((offer) => offer.destination));
    return [
      "all",
      ...LIVE_DESTINATIONS.filter((destination) => available.has(destination)),
    ];
  }, []);

  const categoryCounts = useMemo(() => {
    const base = Object.keys(offerCategoryMeta).reduce((acc, key) => {
      acc[key as OfferCategory] = 0;
      return acc;
    }, {} as Record<OfferCategory, number>);

    offers.forEach((offer) => {
      base[offer.category] += 1;
    });

    return base;
  }, []);

  const filteredOffers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return offers.filter((offer) => {
      if (activeCategory !== "all" && offer.category !== activeCategory) {
        return false;
      }

      if (selectedDestination !== "all" && offer.destination !== selectedDestination) {
        return false;
      }

      if (!query) return true;

      return (
        offer.title.toLowerCase().includes(query) ||
        offer.description.toLowerCase().includes(query) ||
        offer.destination.toLowerCase().includes(query) ||
        offer.code.toLowerCase().includes(query)
      );
    });
  }, [activeCategory, searchQuery, selectedDestination]);

  function resetFilters() {
    setActiveCategory("all");
    setSelectedDestination("all");
    setSearchQuery("");
  }

  async function handleCopyCode(offerId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedOfferId(offerId);
      window.setTimeout(() => setCopiedOfferId(null), 1800);
    } catch {
      // Clipboard can fail on unsupported browsers; keep silent fallback.
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 py-7 md:py-9">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 h-fit lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Filters</h2>
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-semibold text-[#199ce0] hover:underline"
              >
                Clear all
              </button>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-sm font-semibold text-slate-700">Categories</p>
              <div className="mt-3 space-y-1.5">
                {offerFilterOrder.map((filter) => {
                  const count =
                    filter === "all"
                      ? offers.length
                      : categoryCounts[filter as OfferCategory] ?? 0;

                  return (
                    <button
                      key={`filter-${filter}`}
                      type="button"
                      onClick={() => setActiveCategory(filter)}
                      className={`w-full rounded-lg px-2 py-2 text-left text-sm font-medium transition ${
                        activeCategory === filter
                          ? "bg-[#199ce0]/10 text-[#199ce0]"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {filterLabel(filter)} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-sm font-semibold text-slate-700">Destination</p>
              <select
                value={selectedDestination}
                onChange={(event) => setSelectedDestination(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              >
                {destinationOptions.map((destination) => (
                  <option key={`destination-${destination}`} value={destination}>
                    {destination === "all" ? "All destinations" : destination}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-sm font-semibold text-slate-700">Search offers</p>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Code, city, or keyword"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </aside>

          <section>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-3xl md:text-[34px] font-bold text-slate-900">Offers</h1>
                  <p className="mt-1 text-sm md:text-base text-slate-600">
                    Curated deals across your active Yono DMC services.
                  </p>
                </div>
                <Link
                  href="/offers"
                  className="inline-flex items-center gap-2 text-sm md:text-base font-semibold text-[#199ce0] hover:underline"
                >
                  View all offers
                </Link>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredOffers.map((offer) => {
                const Icon = categoryIconMap[offer.category] ?? Banknote;
                const categoryMeta = offerCategoryMeta[offer.category];
                const isCopied = copiedOfferId === offer.id;

                return (
                  <article
                    key={offer.id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="relative h-36">
                      <Image
                        src={offer.image}
                        alt={offer.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        quality={82}

                      />
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#199ce0]/10 px-2.5 py-1 font-semibold text-[#199ce0]">
                          <Icon className="h-3.5 w-3.5" />
                          {categoryMeta.label}
                        </span>
                        <span className="text-slate-500">{offer.destination}</span>
                      </div>

                      <h3 className="mt-3 text-xl md:text-[22px] leading-tight font-semibold text-slate-900 line-clamp-3">
                        {offer.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-3">{offer.description}</p>

                      <div className="mt-4 rounded-xl border border-[#199ce0]/25 bg-[#199ce0]/5 px-3 py-2 flex items-center justify-between gap-3">
                        <span className="text-sm md:text-base font-bold text-slate-900 tracking-wide">
                          {offer.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(offer.id, offer.code)}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[#199ce0] hover:underline"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy code
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          Ends {formatDate(offer.validUntil)}
                        </span>
                        <Link
                          href={offer.href}
                          className="inline-flex h-9 items-center justify-center rounded-full bg-[#199ce0] px-4 text-sm font-semibold text-white hover:opacity-90"
                        >
                          {offer.ctaLabel}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {filteredOffers.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-7 text-center">
                <p className="text-lg font-semibold text-slate-900">No offers found</p>
                <p className="mt-1 text-sm text-slate-600">
                  Try changing category, destination, or search keyword.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Reset filters
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

