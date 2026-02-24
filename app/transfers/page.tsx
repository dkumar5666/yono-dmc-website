"use client";

import { FormEvent, useState } from "react";
import { CarFront, Loader2, PlaneTakeoff } from "lucide-react";

type TransferOffer = {
  id: string;
  transferType: string;
  vehicle: string;
  seats: number;
  baggage: number;
  amount: number;
  currency: string;
  pickupTime?: string;
  source: "amadeus" | "fallback";
};

export default function TransfersPage() {
  const [airportCode, setAirportCode] = useState("DXB");
  const [address, setAddress] = useState("Downtown Dubai");
  const [city, setCity] = useState("Dubai");
  const [countryCode, setCountryCode] = useState("AE");
  const [dateTime, setDateTime] = useState("");
  const [passengers, setPassengers] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<TransferOffer[]>([]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/transfers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLocationCode: airportCode,
          endAddressLine: address,
          endCityName: city,
          endCountryCode: countryCode,
          transferDateTime: dateTime,
          passengers,
          currency: "INR",
        }),
      });

      const data = (await response.json()) as { offers?: TransferOffer[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to search transfers");
      setOffers(data.offers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search transfers");
      setOffers([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Cabs</h1>
          <p className="mt-3 text-slate-200">Search airport and city cab options for your trip.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <form onSubmit={onSearch} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 grid gap-3 md:grid-cols-7">
          <input value={airportCode} onChange={(e) => setAirportCode(e.target.value.toUpperCase())} maxLength={3} placeholder="Airport Code" className="h-12 rounded-xl border border-slate-300 px-3" required />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Drop address" className="h-12 rounded-xl border border-slate-300 px-3" required />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="h-12 rounded-xl border border-slate-300 px-3" required />
          <input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} maxLength={2} placeholder="Country" className="h-12 rounded-xl border border-slate-300 px-3" required />
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="h-12 rounded-xl border border-slate-300 px-3"
            required
          />
          <input
            type="number"
            min={1}
            max={9}
            value={passengers}
            onChange={(e) => setPassengers(Number(e.target.value))}
            className="h-12 rounded-xl border border-slate-300 px-3"
            placeholder="Passengers"
          />
          <button type="submit" disabled={busy} className="h-12 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Search
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => (
            <article key={offer.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <PlaneTakeoff className="h-4 w-4 text-[#199ce0]" />
                <span className="text-sm">{airportCode} to {city}</span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-slate-900">{offer.vehicle}</h2>
              <p className="mt-1 text-sm text-slate-600">{offer.transferType} transfer</p>
              <p className="mt-1 text-sm text-slate-600">Seats: {offer.seats} | Baggage: {offer.baggage}</p>
              <p className="mt-3 text-xl font-bold text-[#f5991c]">{offer.currency} {offer.amount.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-slate-500">Source: {offer.source}</p>
              <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#199ce0] px-4 py-2.5 text-white font-semibold">
                <CarFront className="h-4 w-4" />
                Reserve Cab
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

