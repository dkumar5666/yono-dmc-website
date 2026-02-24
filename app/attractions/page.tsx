"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Info, Loader2, MapPin, Search, Star, Ticket } from "lucide-react";
import { siteConfig } from "@/data/site";
import {
  getTicketedAttractionsByDestination,
  ticketedAttractions as seedAttractions,
  ticketedAttractionCountries as seedCountries,
  type AttractionCountry,
  type TicketedAttraction,
} from "@/data/ticketedAttractions";

type Activity = {
  id: string;
  name: string;
  description: string;
  image: string | null;
  bookingLink: string | null;
  amount: number;
  currency: string;
};

type ActivityCard = {
  id: string;
  title: string;
  image: string;
  rating: number;
  reviews: number;
  location: string;
  detailsHref: string;
  ticketsHref: string;
};

interface AttractionsApiResponse {
  attractions?: TicketedAttraction[];
  countries?: AttractionCountry[];
}

const DEFAULT_DESTINATION = "Dubai";
const DEFAULT_CATALOG = getTicketedAttractionsByDestination(DEFAULT_DESTINATION);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildFallbackRating(value: string): number {
  return Number((4.2 + (hashCode(value) % 80) / 100).toFixed(2));
}

function buildFallbackReviews(value: string): number {
  return 90 + (hashCode(`${value}-reviews`) % 12000);
}

function formatTitle(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "Attractions";
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)} Attractions`;
}

function mapTicketedToCards(items: TicketedAttraction[]): ActivityCard[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    image: item.image,
    rating: item.rating,
    reviews: item.reviews,
    location: item.location,
    detailsHref: `/things-to-do/${item.slug}`,
    ticketsHref: item.ticketsHref,
  }));
}

function mapLiveActivities(destination: string, items: Activity[]): ActivityCard[] {
  const phone = siteConfig.contact.whatsapp.replace(/\D/g, "");

  return items.map((item, index) => {
    const title = item.name || "Activity";
    const activitySlug = slugify(title || `activity-${index + 1}`);
    const detailsParams = new URLSearchParams({
      destination,
      activity: title,
    });
    const ticketsText = `Hi Yono DMC, I want tickets for ${title} in ${destination}. Please share best price.`;

    return {
      id: item.id ?? `activity-${index + 1}`,
      title,
      image: item.image ?? `/api/images/${activitySlug}`,
      rating: buildFallbackRating(title),
      reviews: buildFallbackReviews(title),
      location: destination,
      detailsHref: `/build-package?${detailsParams.toString()}`,
      ticketsHref: `https://wa.me/${phone}?text=${encodeURIComponent(ticketsText)}`,
    };
  });
}

function resolveCatalogMatch(
  destination: string,
  attractions: TicketedAttraction[]
): { countryName: string; items: TicketedAttraction[] } | null {
  const query = normalize(destination);
  if (!query) return null;

  const grouped = new Map<string, TicketedAttraction[]>();
  for (const item of attractions) {
    const key = item.countryKey || item.countryName;
    const list = grouped.get(key);
    if (list) {
      list.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }

  const scored = Array.from(grouped.values())
    .map((items) => {
      const sample = items[0];
      const countryText = normalize(sample.countryName);
      const locationText = normalize(sample.location);
      const cityScore = sample.cities.some((city) => {
        const c = normalize(city);
        return c.includes(query) || query.includes(c);
      })
        ? 2
        : 0;
      const countryScore =
        countryText.includes(query) || query.includes(countryText) ? 3 : 0;
      const locationScore =
        locationText.includes(query) || query.includes(locationText) ? 1 : 0;
      return {
        items,
        score: countryScore + cityScore + locationScore,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.items.length - a.items.length);

  if (scored.length === 0) return null;
  return {
    countryName: scored[0].items[0].countryName,
    items: scored[0].items,
  };
}

function AttractionsPageContent() {
  const searchParams = useSearchParams();
  const requestedDestination = (searchParams.get("destination") ?? "").trim();

  const [destination, setDestination] = useState(DEFAULT_DESTINATION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogCountry, setCatalogCountry] = useState(
    DEFAULT_CATALOG?.country.name ?? "United Arab Emirates"
  );
  const [catalogCountries, setCatalogCountries] = useState<AttractionCountry[]>(seedCountries);
  const [catalogAttractions, setCatalogAttractions] = useState<TicketedAttraction[]>(
    seedAttractions
  );
  const [activities, setActivities] = useState<ActivityCard[]>(
    mapTicketedToCards(DEFAULT_CATALOG?.items ?? [])
  );

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/attractions", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as AttractionsApiResponse;
        if (!Array.isArray(data.attractions) || data.attractions.length === 0) return;

        setCatalogAttractions(data.attractions);
        if (Array.isArray(data.countries) && data.countries.length > 0) {
          setCatalogCountries(data.countries);
        }

        const target = requestedDestination || DEFAULT_DESTINATION;
        const match = resolveCatalogMatch(target, data.attractions);
        if (match) {
          setDestination(target);
          setCatalogCountry(match.countryName);
          setActivities(mapTicketedToCards(match.items));
          setError(null);
        }
      } catch {
        // keep seeded fallback
      }
    })();
  }, [requestedDestination]);

  useEffect(() => {
    if (!requestedDestination) return;
    const match = resolveCatalogMatch(requestedDestination, catalogAttractions);
    if (!match) return;
    setDestination(requestedDestination);
    setCatalogCountry(match.countryName);
    setActivities(mapTicketedToCards(match.items));
    setError(null);
  }, [requestedDestination, catalogAttractions]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const destinationText = destination.trim();
    if (!destinationText) return;

    const catalogMatch = resolveCatalogMatch(destinationText, catalogAttractions);
    if (catalogMatch) {
      setError(null);
      setCatalogCountry(catalogMatch.countryName);
      setActivities(mapTicketedToCards(catalogMatch.items));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/activities/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: destinationText, radius: 20 }),
      });
      const data = (await response.json()) as { activities?: Activity[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to fetch activities");
      const mapped = mapLiveActivities(destinationText, data.activities ?? []);
      setCatalogCountry(destinationText);
      setActivities(mapped);
      if (!data.activities || data.activities.length === 0) {
        setError("No activities found for this destination.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch activities");
      setActivities([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">{formatTitle(destination)}</h1>
          <p className="mt-3 text-slate-200">
            Ticket-ready attractions, tours, theme parks, cruises, and adventure experiences.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <form
          onSubmit={onSearch}
          className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 flex flex-col md:flex-row gap-3"
        >
          <label className="h-12 flex-1 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#199ce0]" />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Destination city or country"
              className="w-full bg-transparent outline-none"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-xl bg-[#199ce0] text-white font-semibold px-6 inline-flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <Search className="h-4 w-4" />
            Load Activities
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            {activities.length} options
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            Destination: {catalogCountry}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {catalogCountries.map((country) => (
            <button
              key={country.key}
              type="button"
              onClick={() => {
                setDestination(country.name);
                setCatalogCountry(country.name);
                const match = resolveCatalogMatch(country.name, catalogAttractions);
                setActivities(mapTicketedToCards(match?.items ?? []));
                setError(null);
              }}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[#199ce0] hover:text-[#199ce0]"
            >
              {country.name}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <CircleAlert className="h-4 w-4" />
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activities.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-sm transition hover:shadow-md"
            >
              <div className="flex gap-3">
                <Link href={item.detailsHref} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"

                  />
                  <div className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-[#f5991c]">
                    <Star className="h-2.5 w-2.5 fill-[#f5991c] text-[#f5991c]" />
                    {item.rating} ({item.reviews})
                  </div>
                </Link>

                <div className="min-w-0 flex-1">
                  <Link href={item.detailsHref} className="line-clamp-2 text-[18px] font-semibold leading-snug text-slate-900 hover:text-[#199ce0]">
                    {item.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-600">{item.location}</p>
                </div>
              </div>

              <div className="mt-2 flex gap-2">
                <Link
                  href={item.detailsHref}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-slate-600 px-3 text-xs font-semibold text-white"
                >
                  <Info className="h-3.5 w-3.5" />
                  Details
                </Link>
                <a
                  href={item.ticketsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-[#5ab546] px-3 text-xs font-semibold text-white"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Tickets
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function AttractionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AttractionsPageContent />
    </Suspense>
  );
}

