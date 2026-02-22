"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plane, Info, Loader2, CheckCircle2 } from "lucide-react";

type FlightSegmentSummary = {
  from: string;
  to: string;
  departureAt: string;
  arrivalAt: string;
  carrierCode: string;
  flightNumber: string;
  duration: string;
};

type FlightItinerarySummary = {
  duration: string;
  stops: number;
  segments: FlightSegmentSummary[];
};

type FlightOfferSummary = {
  id: string;
  source: "amadeus";
  currency: string;
  totalPrice: number;
  validatingAirlineCodes: string[];
  itineraries: FlightItinerarySummary[];
  raw: unknown;
};

type BookingRecord = {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  paymentIntentId?: string;
};

type PaymentIntent = {
  id: string;
  status: string;
};

const initialSearch = {
  from: "DEL",
  to: "DXB",
  date: "",
  adults: 1,
  travelClass: "ECONOMY",
};

function FlightsPageContent() {
  const searchParams = useSearchParams();
  const [searchForm, setSearchForm] = useState(initialSearch);
  const [offers, setOffers] = useState<FlightOfferSummary[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<FlightOfferSummary | null>(null);

  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [traveler, setTraveler] = useState({
    firstName: "",
    lastName: "",
  });

  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [providerPaymentId, setProviderPaymentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<
    "search" | "book" | "intent" | "confirm" | null
  >(null);

  const canCreateBooking = useMemo(() => {
    return (
      selectedOffer &&
      contact.name.trim() &&
      contact.email.trim() &&
      contact.phone.trim() &&
      traveler.firstName.trim() &&
      traveler.lastName.trim()
    );
  }, [contact, selectedOffer, traveler]);

  async function runFlightSearch(payload: typeof initialSearch) {
    setError(null);
    setBusyStep("search");
    setBooking(null);
    setPaymentIntent(null);

    try {
      const response = await fetch("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: payload.from.toUpperCase(),
          to: payload.to.toUpperCase(),
          date: payload.date,
          adults: payload.adults,
          travelClass: payload.travelClass,
          currency: "INR",
          max: 10,
        }),
      });

      const data = (await response.json()) as {
        offers?: FlightOfferSummary[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Search failed");
      }

      const resultOffers = data.offers ?? [];
      setOffers(resultOffers);
      setSelectedOffer(resultOffers[0] ?? null);

      if (resultOffers.length === 0) {
        setError("No offers found for the selected route/date.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      setError(message);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleSearchFlights(e: FormEvent) {
    e.preventDefault();
    await runFlightSearch(searchForm);
  }

  useEffect(() => {
    const from = (searchParams.get("from") ?? "").toUpperCase();
    const to = (searchParams.get("to") ?? "").toUpperCase();
    const date = searchParams.get("date") ?? "";
    const adults = Number(searchParams.get("adults") ?? "1");

    if (!from || !to || !date) return;

    const nextSearch = {
      ...initialSearch,
      from,
      to,
      date,
      adults: Number.isFinite(adults) && adults > 0 ? adults : 1,
    };
    setSearchForm(nextSearch);
    void runFlightSearch(nextSearch);
  }, [searchParams]);

  async function handleCreateBooking() {
    if (!selectedOffer || !canCreateBooking) return;
    setError(null);
    setBusyStep("book");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "flight",
          offerId: selectedOffer.id,
          offerSnapshot: selectedOffer.raw,
          amount: selectedOffer.totalPrice,
          currency: selectedOffer.currency,
          contact,
          travelers: [
            {
              firstName: traveler.firstName.trim(),
              lastName: traveler.lastName.trim(),
            },
          ],
        }),
      });

      const data = (await response.json()) as { booking?: BookingRecord; error?: string };
      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "Booking creation failed");
      }

      setBooking(data.booking);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Booking creation failed";
      setError(message);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleCreatePaymentIntent() {
    if (!booking) return;
    setError(null);
    setBusyStep("intent");

    try {
      const response = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const data = (await response.json()) as {
        paymentIntent?: PaymentIntent;
        booking?: BookingRecord;
        error?: string;
      };

      if (!response.ok || !data.paymentIntent) {
        throw new Error(data.error ?? "Payment intent failed");
      }

      setPaymentIntent(data.paymentIntent);
      if (data.booking) setBooking(data.booking);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment intent failed";
      setError(message);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleConfirmPayment() {
    if (!booking || !paymentIntent) return;
    setError(null);
    setBusyStep("confirm");

    try {
      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentIntentId: paymentIntent.id,
          providerPaymentId: providerPaymentId.trim() || undefined,
        }),
      });

      const data = (await response.json()) as {
        booking?: BookingRecord;
        error?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "Payment confirmation failed");
      }

      setBooking(data.booking);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Payment confirmation failed";
      setError(message);
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-blue-900 text-white py-16 text-center">
        <Plane className="w-16 h-16 mx-auto mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Flight Bookings</h1>
        <p className="text-xl text-gray-300">
          Search, select, and complete booking in one flow
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <form onSubmit={handleSearchFlights} className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">1. Search Flights</h2>

          <div className="grid md:grid-cols-5 gap-4">
            <input
              required
              placeholder="From (IATA)"
              value={searchForm.from}
              onChange={(e) => setSearchForm({ ...searchForm, from: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg uppercase"
              maxLength={3}
            />
            <input
              required
              placeholder="To (IATA)"
              value={searchForm.to}
              onChange={(e) => setSearchForm({ ...searchForm, to: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg uppercase"
              maxLength={3}
            />
            <input
              required
              type="date"
              value={searchForm.date}
              onChange={(e) => setSearchForm({ ...searchForm, date: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
            />
            <input
              required
              type="number"
              min={1}
              max={9}
              value={searchForm.adults}
              onChange={(e) =>
                setSearchForm({ ...searchForm, adults: Number(e.target.value) })
              }
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="Adults"
            />
            <select
              value={searchForm.travelClass}
              onChange={(e) =>
                setSearchForm({ ...searchForm, travelClass: e.target.value })
              }
              className="w-full px-4 py-3 border rounded-lg"
            >
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={busyStep !== null}
            className="mt-6 inline-flex items-center gap-2 bg-blue-900 text-white px-6 py-3 rounded-lg disabled:opacity-60"
          >
            {busyStep === "search" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Search Offers
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">2. Select an Offer</h2>
          {offers.length === 0 ? (
            <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
              <Info className="w-5 h-5 text-blue-600" />
              <p className="text-sm">Search flights to view available offers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setSelectedOffer(offer)}
                  className={`w-full text-left border rounded-xl p-4 transition ${
                    selectedOffer?.id === offer.id
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {offer.itineraries[0]?.segments[0]?.from} to{" "}
                        {
                          offer.itineraries[0]?.segments[
                            offer.itineraries[0].segments.length - 1
                          ]?.to
                        }
                      </p>
                      <p className="text-sm text-gray-600">
                        Airline: {offer.validatingAirlineCodes.join(", ") || "N/A"} | Stops:{" "}
                        {offer.itineraries[0]?.stops ?? 0}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-blue-900">
                      {offer.currency} {offer.totalPrice.toLocaleString("en-IN")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">3. Traveler and Contact Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              required
              placeholder="Contact Name"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
            />
            <input
              required
              placeholder="Email"
              type="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
            />
            <input
              required
              placeholder="Phone"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
            />
            <div />
            <input
              required
              placeholder="Traveler First Name"
              value={traveler.firstName}
              onChange={(e) => setTraveler({ ...traveler, firstName: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
            />
            <input
              required
              placeholder="Traveler Last Name"
              value={traveler.lastName}
              onChange={(e) => setTraveler({ ...traveler, lastName: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateBooking}
            disabled={!canCreateBooking || busyStep !== null}
            className="mt-6 inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg disabled:opacity-60"
          >
            {busyStep === "book" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Booking
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">4. Payment and Confirmation</h2>

          {booking ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Booking Reference: <span className="font-semibold">{booking.reference}</span>
              </p>
              <p className="text-sm text-gray-700">
                Status: <span className="font-semibold capitalize">{booking.status}</span>
              </p>

              {!paymentIntent ? (
                <button
                  type="button"
                  onClick={handleCreatePaymentIntent}
                  disabled={busyStep !== null}
                  className="inline-flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-lg disabled:opacity-60"
                >
                  {busyStep === "intent" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Create Payment Intent
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    Payment Intent: <span className="font-semibold">{paymentIntent.id}</span>
                  </p>
                  <input
                    placeholder="Provider Payment ID (optional for MVP)"
                    value={providerPaymentId}
                    onChange={(e) => setProviderPaymentId(e.target.value)}
                    className="w-full md:w-[420px] px-4 py-3 border rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={busyStep !== null || booking.status === "confirmed"}
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg disabled:opacity-60"
                  >
                    {busyStep === "confirm" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Confirm Payment and Booking
                  </button>
                </div>
              )}

              {booking.status === "confirmed" ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-700">Booking Confirmed</p>
                    <p className="text-sm text-green-700">
                      Reference: {booking.reference}. Next step is ticketing and traveler notification.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Create booking from selected offer to proceed with payment.
            </p>
          )}
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function FlightsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <FlightsPageContent />
    </Suspense>
  );
}
