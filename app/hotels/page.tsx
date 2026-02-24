"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BedDouble, CalendarDays, Loader2, MapPin, Users } from "lucide-react";

type HotelOffer = {
  hotelId: string;
  name: string;
  cityCode: string;
  address: string;
  rating: string;
  offerId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  totalPrice: number;
  currency: string;
  cancellationDeadline?: string;
  source: "amadeus";
};

type HotelSearchPayload = {
  cityCode: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  rooms: number;
};

type StayType = "all" | "homestay" | "villa" | "apartment" | "hotel";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateDDMMYYYY(value: string): string {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return formatDateISO(date);
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseTravelerCount(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const match = value.match(/\d+/);
  if (!match) return fallback;
  return parsePositiveInt(match[0], fallback);
}

function resolveCityCode(input: string): string {
  const cleaned = input.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(cleaned)) return cleaned;

  const query = normalize(input);
  const cityHints: Array<{ code: string; keywords: string[] }> = [
    { code: "DXB", keywords: ["dubai", "uae", "united arab emirates", "emirates"] },
    { code: "AUH", keywords: ["abu dhabi"] },
    { code: "SIN", keywords: ["singapore", "sentosa"] },
    { code: "KUL", keywords: ["kuala lumpur", "malaysia", "genting", "penang"] },
    { code: "DPS", keywords: ["bali", "indonesia", "ubud", "kuta", "seminyak"] },
    { code: "BKK", keywords: ["bangkok", "thailand"] },
    { code: "HKT", keywords: ["phuket"] },
    { code: "TYO", keywords: ["japan", "tokyo"] },
    { code: "OSA", keywords: ["osaka"] },
    { code: "SEL", keywords: ["seoul", "south korea", "korea"] },
    { code: "IST", keywords: ["istanbul", "turkey"] },
    { code: "MEL", keywords: ["melbourne"] },
    { code: "SYD", keywords: ["sydney", "australia"] },
    { code: "MRU", keywords: ["mauritius"] },
    { code: "DEL", keywords: ["india", "delhi"] },
  ];

  const match = cityHints.find((hint) =>
    hint.keywords.some((keyword) => query.includes(normalize(keyword)))
  );
  return match?.code ?? "DXB";
}

function resolveStayTypeFromName(name: string): StayType {
  const value = normalize(name);
  if (value.includes("villa")) return "villa";
  if (value.includes("apartment") || value.includes("suite")) return "apartment";
  if (value.includes("home") || value.includes("homestay")) return "homestay";
  return "hotel";
}

function HotelsPageContent() {
  const searchParams = useSearchParams();

  const baseDate = formatDateISO(new Date());
  const defaultCheckIn = addDays(baseDate, 7) || baseDate;
  const defaultCheckOut = addDays(defaultCheckIn, 2) || defaultCheckIn;

  const [destinationInput, setDestinationInput] = useState("Dubai");
  const [cityCode, setCityCode] = useState("DXB");
  const [checkInDate, setCheckInDate] = useState(defaultCheckIn);
  const [checkOutDate, setCheckOutDate] = useState(defaultCheckOut);
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<HotelOffer[]>([]);
  const [stayType, setStayType] = useState<StayType>("all");

  const filteredOffers = useMemo(() => {
    if (stayType === "all") return offers;
    return offers.filter((item) => resolveStayTypeFromName(item.name) === stayType);
  }, [offers, stayType]);

  async function runSearch(payload: HotelSearchPayload) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityCode: payload.cityCode.toUpperCase(),
          checkInDate: payload.checkInDate,
          checkOutDate: payload.checkOutDate,
          adults: payload.adults,
          rooms: payload.rooms,
          currency: "INR",
          max: 20,
        }),
      });
      const data = (await response.json()) as { offers?: HotelOffer[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to fetch hotels");
      setOffers(data.offers ?? []);
      setCityCode(payload.cityCode.toUpperCase());
      if (!data.offers || data.offers.length === 0) {
        setError("No hotels found for selected city/date.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch hotels");
      setOffers([]);
    } finally {
      setBusy(false);
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const resolvedCityCode = resolveCityCode(destinationInput);
    const finalCheckIn = checkInDate || defaultCheckIn;
    const finalCheckOut = checkOutDate || addDays(finalCheckIn, 2) || defaultCheckOut;
    await runSearch({
      cityCode: resolvedCityCode,
      checkInDate: finalCheckIn,
      checkOutDate: finalCheckOut,
      adults: Math.max(1, adults),
      rooms: Math.max(1, rooms),
    });
  }

  useEffect(() => {
    const queryDestination = (
      searchParams.get("destination") ??
      searchParams.get("cityCode") ??
      ""
    ).trim();
    if (!queryDestination) return;

    const queryDate = (
      searchParams.get("date") ??
      searchParams.get("checkInDate") ??
      ""
    ).trim();
    const queryCheckOut = (searchParams.get("checkOutDate") ?? "").trim();
    const normalizedCheckIn = /^\d{4}-\d{2}-\d{2}$/.test(queryDate)
      ? queryDate
      : defaultCheckIn;
    const normalizedCheckOut = /^\d{4}-\d{2}-\d{2}$/.test(queryCheckOut)
      ? queryCheckOut
      : addDays(normalizedCheckIn, 2) || defaultCheckOut;

    const queryAdults = parsePositiveInt(
      searchParams.get("adults"),
      parseTravelerCount(searchParams.get("travelers"), 2)
    );
    const queryRooms = parsePositiveInt(searchParams.get("rooms"), 1);
    const resolvedCityCode = resolveCityCode(queryDestination);

    setDestinationInput(queryDestination);
    setCheckInDate(normalizedCheckIn);
    setCheckOutDate(normalizedCheckOut);
    setAdults(queryAdults);
    setRooms(queryRooms);

    void runSearch({
      cityCode: resolvedCityCode,
      checkInDate: normalizedCheckIn,
      checkOutDate: normalizedCheckOut,
      adults: queryAdults,
      rooms: queryRooms,
    });
  }, [searchParams, defaultCheckIn, defaultCheckOut]);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Stays</h1>
          <p className="mt-3 text-slate-200">Live hotel search using Amadeus inventory.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { id: "all", label: "All Stays" },
            { id: "homestay", label: "HomeStay" },
            { id: "villa", label: "Villa" },
            { id: "apartment", label: "Apartment" },
            { id: "hotel", label: "Hotel" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStayType(item.id as StayType)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                stayType === item.id
                  ? "border-[#199ce0] bg-[#199ce0] text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={onSearch}
          className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 grid gap-3 md:grid-cols-6"
        >
          <label className="md:col-span-2 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#199ce0]" />
            <input
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              placeholder="Destination or City Code"
              className="w-full bg-transparent outline-none"
              required
            />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#199ce0]" />
            <input
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              lang="en-GB"
              className="w-full bg-transparent outline-none"
              required
            />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#199ce0]" />
            <input
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              lang="en-GB"
              className="w-full bg-transparent outline-none"
              required
            />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-[#199ce0]" />
            <input
              type="number"
              min={1}
              max={8}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
              className="w-full bg-transparent outline-none"
            />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-[#199ce0]" />
            <input
              type="number"
              min={1}
              max={4}
              value={rooms}
              onChange={(e) => setRooms(Number(e.target.value))}
              className="w-full bg-transparent outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="md:col-span-6 h-12 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Search Hotels
          </button>
        </form>

        <p className="mt-3 text-sm text-slate-600">
          Resolved city code: <span className="font-semibold">{cityCode}</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Showing category:{" "}
          <span className="font-semibold capitalize">
            {stayType === "all" ? "All Stays" : stayType}
          </span>
        </p>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {!error && offers.length > 0 && filteredOffers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-700">
            No {stayType} results in current inventory. Try another category.
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOffers.map((hotel) => (
            <article
              key={`${hotel.hotelId}-${hotel.offerId}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{hotel.cityCode}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{hotel.name}</h2>
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                {hotel.address || "Address unavailable"}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Rating: <span className="font-semibold">{hotel.rating}</span>
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatDateDDMMYYYY(hotel.checkInDate)} to{" "}
                {formatDateDDMMYYYY(hotel.checkOutDate)}
              </p>
              <p className="mt-3 text-xl font-bold text-[#f5991c]">
                {hotel.currency} {hotel.totalPrice.toLocaleString("en-IN")}
              </p>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/flights?from=DEL&to=${encodeURIComponent(
                    hotel.cityCode
                  )}&date=${encodeURIComponent(hotel.checkInDate)}&adults=${hotel.adults}`}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-[#199ce0] px-4 py-2 text-sm font-semibold text-[#199ce0]"
                >
                  Add Flights
                </Link>
                <Link
                  href={`/build-package?destination=${encodeURIComponent(
                    destinationInput
                  )}&travelDate=${encodeURIComponent(
                    hotel.checkInDate
                  )}&adults=${hotel.adults}`}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white"
                >
                  Customize
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function HotelsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <HotelsPageContent />
    </Suspense>
  );
}
