"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plane,
  Info,
  Loader2,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  ArrowRightLeft,
  Clock3,
  Users,
} from "lucide-react";

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

type SupplierFlightBookingResult = {
  supplier: "amadeus";
  skipped?: boolean;
  reason?: string;
  amadeus_order_id?: string;
  pnr?: string;
};

const initialSearch = {
  from: "DEL",
  to: "DXB",
  date: "",
  adults: 1,
  travelClass: "ECONOMY",
};

function parseDurationToMinutes(value: string): number {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  return hours * 60 + minutes;
}

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatDuration(value: string): string {
  const totalMinutes = parseDurationToMinutes(value);
  if (!Number.isFinite(totalMinutes) || totalMinutes === Number.MAX_SAFE_INTEGER) {
    return value;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function buildFlightBookingTravelersPayload(input: {
  traveler: { firstName: string; lastName: string };
  contact: { email: string; phone: string };
}): Array<Record<string, unknown>> {
  const firstName = input.traveler.firstName.trim().toUpperCase();
  const lastName = input.traveler.lastName.trim().toUpperCase();
  const email = input.contact.email.trim();
  const phoneDigits = input.contact.phone.replace(/[^\d]/g, "");

  const payload: Record<string, unknown> = {
    id: "1",
    travelerType: "ADULT",
    name: {
      firstName: firstName || "GUEST",
      lastName: lastName || "TRAVELER",
    },
  };

  if (email || phoneDigits) {
    payload.contact = {
      ...(email ? { emailAddress: email } : {}),
      ...(phoneDigits
        ? {
            phones: [
              {
                deviceType: "MOBILE",
                number: phoneDigits,
              },
            ],
          }
        : {}),
    };
  }

  return [payload];
}

function FlightsPageContent() {
  const searchParams = useSearchParams();
  const [searchForm, setSearchForm] = useState(initialSearch);
  const [offers, setOffers] = useState<FlightOfferSummary[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<FlightOfferSummary | null>(null);
  const [stopsFilter, setStopsFilter] = useState<"all" | "nonstop" | "1plus" | "2plus">(
    "all"
  );
  const [airlineFilter, setAirlineFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "duration-asc">(
    "price-asc"
  );
  const [maxPriceInput, setMaxPriceInput] = useState<number | null>(null);

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
  const [supplierBookingResult, setSupplierBookingResult] =
    useState<SupplierFlightBookingResult | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<
    "search" | "price" | "book" | "intent" | "confirm" | "supplier" | null
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

  const maxOfferPrice = useMemo(() => {
    if (offers.length === 0) return 0;
    return Math.max(...offers.map((offer) => offer.totalPrice));
  }, [offers]);

  const effectiveMaxPrice = maxPriceInput ?? maxOfferPrice;

  const airlineOptions = useMemo(() => {
    return Array.from(
      new Set(offers.flatMap((offer) => offer.validatingAirlineCodes))
    ).sort((a, b) => a.localeCompare(b));
  }, [offers]);

  const filteredOffers = useMemo(() => {
    const items = offers.filter((offer) => {
      const itinerary = offer.itineraries[0];
      const stops = itinerary?.stops ?? 0;
      const firstAirline = offer.validatingAirlineCodes[0] ?? "";

      if (maxOfferPrice > 0 && offer.totalPrice > effectiveMaxPrice) return false;
      if (airlineFilter !== "all" && firstAirline !== airlineFilter) return false;
      if (stopsFilter === "nonstop" && stops !== 0) return false;
      if (stopsFilter === "1plus" && stops < 1) return false;
      if (stopsFilter === "2plus" && stops < 2) return false;

      return true;
    });

    const sorted = [...items];
    sorted.sort((a, b) => {
      if (sortBy === "price-asc") return a.totalPrice - b.totalPrice;
      if (sortBy === "price-desc") return b.totalPrice - a.totalPrice;

      const aDuration = parseDurationToMinutes(a.itineraries[0]?.duration ?? "");
      const bDuration = parseDurationToMinutes(b.itineraries[0]?.duration ?? "");
      return aDuration - bDuration;
    });

    return sorted;
  }, [offers, airlineFilter, stopsFilter, sortBy, effectiveMaxPrice, maxOfferPrice]);

  async function runFlightSearch(payload: typeof initialSearch) {
    setError(null);
    setBusyStep("search");
    setBooking(null);
    setPaymentIntent(null);
    setSupplierBookingResult(null);

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
      setStopsFilter("all");
      setAirlineFilter("all");
      setSortBy("price-asc");
      setMaxPriceInput(null);

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
    setSupplierBookingResult(null);

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

  async function handleVerifyPrice() {
    if (!selectedOffer) return;
    setError(null);
    setPriceNotice(null);
    setBusyStep("price");
    try {
      const response = await fetch("/api/flights/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_id: selectedOffer.id,
          raw_offer:
            toObject(selectedOffer.raw) ||
            toObject((selectedOffer as unknown as Record<string, unknown>).raw_offer) ||
            null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        priced_offer?: FlightOfferSummary;
      };
      if (!response.ok || !payload.ok || !payload.priced_offer) {
        throw new Error(payload.error || "Price verification failed");
      }

      const nextOffer = payload.priced_offer;
      setSelectedOffer(nextOffer);
      setOffers((prev) =>
        prev.map((offer) => (offer.id === selectedOffer.id ? nextOffer : offer))
      );
      setPriceNotice(
        `Latest price verified: ${nextOffer.currency} ${nextOffer.totalPrice.toLocaleString("en-IN")}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Price verification failed";
      setError(message);
    } finally {
      setBusyStep(null);
    }
  }

  async function handleCreatePaymentIntent() {
    if (!booking) return;
    setError(null);
    setBusyStep("intent");
    setSupplierBookingResult(null);

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
    setSupplierBookingResult(null);
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

      if (!selectedOffer || !selectedOffer.raw || typeof selectedOffer.raw !== "object") {
        setError(
          "Payment confirmed, but supplier booking was skipped because flight offer data is unavailable."
        );
        return;
      }

      setBusyStep("supplier");

      try {
        const supplierResponse = await fetch("/api/flights/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: data.booking.id,
            offer: selectedOffer.raw,
            travelers: buildFlightBookingTravelersPayload({ traveler, contact }),
          }),
        });

        const supplierData = (await supplierResponse.json()) as {
          ok?: boolean;
          error?: string;
          supplier?: "amadeus";
          skipped?: boolean;
          reason?: string;
          amadeus_order_id?: string;
          pnr?: string;
        };

        if (!supplierResponse.ok || !supplierData.ok) {
          throw new Error(supplierData.error ?? "Flight supplier booking failed");
        }

        setSupplierBookingResult({
          supplier: "amadeus",
          skipped: supplierData.skipped,
          reason: supplierData.reason,
          amadeus_order_id: supplierData.amadeus_order_id,
          pnr: supplierData.pnr,
        });
      } catch (supplierError) {
        const supplierMessage =
          supplierError instanceof Error
            ? supplierError.message
            : "Flight supplier booking failed";
        setError(`Payment confirmed, but supplier booking failed: ${supplierMessage}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Payment confirmation failed";
      setError(message);
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#199ce0]/12 flex items-center justify-center">
              <Plane className="h-5 w-5 text-[#199ce0]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Flights</h1>
              <p className="text-sm text-slate-600">
                Search, compare, and book your flight in one flow.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSearchFlights}
            className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:p-4"
          >
            <div className="grid gap-2 md:grid-cols-12">
              <label className="md:col-span-2 h-11 rounded-xl border border-slate-300 bg-white px-3 inline-flex items-center">
                <input
                  required
                  placeholder="From (IATA)"
                  value={searchForm.from}
                  onChange={(e) => setSearchForm({ ...searchForm, from: e.target.value })}
                  className="w-full bg-transparent outline-none uppercase text-sm"
                  maxLength={3}
                />
              </label>
              <label className="md:col-span-2 h-11 rounded-xl border border-slate-300 bg-white px-3 inline-flex items-center">
                <input
                  required
                  placeholder="To (IATA)"
                  value={searchForm.to}
                  onChange={(e) => setSearchForm({ ...searchForm, to: e.target.value })}
                  className="w-full bg-transparent outline-none uppercase text-sm"
                  maxLength={3}
                />
              </label>
              <label className="md:col-span-3 h-11 rounded-xl border border-slate-300 bg-white px-3 inline-flex items-center">
                <input
                  required
                  type="date"
                  value={searchForm.date}
                  onChange={(e) => setSearchForm({ ...searchForm, date: e.target.value })}
                  lang="en-GB"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </label>
              <label className="md:col-span-2 h-11 rounded-xl border border-slate-300 bg-white px-3 inline-flex items-center">
                <input
                  required
                  type="number"
                  min={1}
                  max={9}
                  value={searchForm.adults}
                  onChange={(e) =>
                    setSearchForm({ ...searchForm, adults: Number(e.target.value) })
                  }
                  className="w-full bg-transparent outline-none text-sm"
                  placeholder="Adults"
                />
              </label>
              <select
                value={searchForm.travelClass}
                onChange={(e) =>
                  setSearchForm({ ...searchForm, travelClass: e.target.value })
                }
                className="md:col-span-2 h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="ECONOMY">Economy</option>
                <option value="PREMIUM_ECONOMY">Premium Economy</option>
                <option value="BUSINESS">Business</option>
                <option value="FIRST">First</option>
              </select>
              <button
                type="submit"
                disabled={busyStep !== null}
                className="md:col-span-1 h-11 rounded-xl bg-[#199ce0] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busyStep === "search" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="h-4 w-4 text-[#199ce0]" />
              <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                  Stops
                </p>
                <div className="space-y-1.5">
                  {[
                    { key: "all", label: "All" },
                    { key: "nonstop", label: "Non-stop" },
                    { key: "1plus", label: "1+ Stop" },
                    { key: "2plus", label: "2+ Stops" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setStopsFilter(item.key as "all" | "nonstop" | "1plus" | "2plus")
                      }
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        stopsFilter === item.key
                          ? "bg-[#199ce0]/10 text-[#199ce0] font-semibold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                  Airline
                </p>
                <select
                  value={airlineFilter}
                  onChange={(e) => setAirlineFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                >
                  <option value="all">All airlines</option>
                  {airlineOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                  Max price
                </p>
                <input
                  type="range"
                  min={0}
                  max={maxOfferPrice || 10000}
                  step={500}
                  value={effectiveMaxPrice || 0}
                  onChange={(e) => setMaxPriceInput(Number(e.target.value))}
                  className="w-full"
                  disabled={maxOfferPrice === 0}
                />
                <p className="text-sm font-semibold text-slate-800">
                  INR {effectiveMaxPrice.toLocaleString("en-IN")}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                  Sort by
                </p>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "price-asc" | "price-desc" | "duration-asc")
                  }
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                >
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="duration-asc">Shortest Duration</option>
                </select>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-slate-900">Available Offers</h2>
                <div className="flex items-center gap-2">
                  {selectedOffer ? (
                    <button
                      type="button"
                      onClick={handleVerifyPrice}
                      disabled={busyStep !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 disabled:opacity-60"
                    >
                      {busyStep === "price" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Verify price
                    </button>
                  ) : null}
                  <p className="text-sm text-slate-600">
                    {filteredOffers.length} result{filteredOffers.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              {priceNotice ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {priceNotice}
                </div>
              ) : null}

              {offers.length === 0 ? (
                <div className="mt-3 bg-blue-50 p-3 rounded-lg flex gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-sm">Search flights to view live offers.</p>
                </div>
              ) : filteredOffers.length === 0 ? (
                <div className="mt-3 bg-amber-50 p-3 rounded-lg text-sm text-amber-800">
                  No offers match selected filters. Adjust your filters to continue.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {filteredOffers.map((offer) => {
                    const outbound = offer.itineraries[0];
                    const firstSegment = outbound?.segments[0];
                    const lastSegment =
                      outbound?.segments[outbound.segments.length - 1];
                    const isSelected = selectedOffer?.id === offer.id;

                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => setSelectedOffer(offer)}
                        className={`w-full text-left rounded-xl border p-3 transition ${
                          isSelected
                            ? "border-[#199ce0] bg-[#199ce0]/5"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {firstSegment?.from ?? "N/A"}{" "}
                              <ArrowRightLeft className="inline h-3.5 w-3.5 mx-1 text-slate-400" />{" "}
                              {lastSegment?.to ?? "N/A"}
                            </p>
                            <p className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5 text-[#199ce0]" />
                                {formatDuration(outbound?.duration ?? "")}
                              </span>
                              <span>{offer.validatingAirlineCodes.join(", ") || "N/A"}</span>
                              <span>
                                {outbound?.stops === 0
                                  ? "Non-stop"
                                  : `${outbound?.stops ?? 0} stop(s)`}
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-slate-900">
                              {offer.currency} {offer.totalPrice.toLocaleString("en-IN")}
                            </p>
                            <span
                              className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isSelected
                                  ? "bg-[#199ce0] text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xl font-semibold text-slate-900">Traveler & Contact</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  required
                  placeholder="Contact Name"
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <input
                  required
                  placeholder="Email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <input
                  required
                  placeholder="Phone"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <div />
                <input
                  required
                  placeholder="Traveler First Name"
                  value={traveler.firstName}
                  onChange={(e) => setTraveler({ ...traveler, firstName: e.target.value })}
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <input
                  required
                  placeholder="Traveler Last Name"
                  value={traveler.lastName}
                  onChange={(e) => setTraveler({ ...traveler, lastName: e.target.value })}
                  className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateBooking}
                disabled={!canCreateBooking || busyStep !== null}
                className="mt-3 inline-flex items-center gap-2 h-11 rounded-xl bg-[#199ce0] text-white px-5 text-sm font-semibold disabled:opacity-60"
              >
                {busyStep === "book" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                Create Booking
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-xl font-semibold text-slate-900">Payment & Confirmation</h3>

              {booking ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-slate-700">
                    Booking Reference: <span className="font-semibold">{booking.reference}</span>
                  </p>
                  <p className="text-sm text-slate-700">
                    Status: <span className="font-semibold capitalize">{booking.status}</span>
                  </p>

                  {!paymentIntent ? (
                    <button
                      type="button"
                      onClick={handleCreatePaymentIntent}
                      disabled={busyStep !== null}
                      className="inline-flex items-center gap-2 h-11 rounded-xl bg-[#f5991c] text-white px-5 text-sm font-semibold disabled:opacity-60"
                    >
                      {busyStep === "intent" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      Create Payment Intent
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-700">
                        Payment Intent:{" "}
                        <span className="font-semibold">{paymentIntent.id}</span>
                      </p>
                      <input
                        placeholder="Provider Payment ID (optional for MVP)"
                        value={providerPaymentId}
                        onChange={(e) => setProviderPaymentId(e.target.value)}
                        className="h-11 w-full md:w-[420px] rounded-lg border border-slate-300 px-3 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={busyStep !== null || booking.status === "confirmed"}
                        className="inline-flex items-center gap-2 h-11 rounded-xl bg-green-600 text-white px-5 text-sm font-semibold disabled:opacity-60"
                      >
                        {busyStep === "confirm" || busyStep === "supplier" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        {busyStep === "supplier"
                          ? "Finalizing Supplier Booking..."
                          : "Confirm Payment & Booking"}
                      </button>
                    </div>
                  )}

                  {booking.status === "confirmed" ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-700 text-sm">Booking Confirmed</p>
                        <p className="text-xs text-green-700">
                          Reference: {booking.reference}. Ticketing and customer notification can
                          proceed.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {supplierBookingResult ? (
                    <div
                      className={`rounded-lg border p-3 flex gap-2 ${
                        supplierBookingResult.skipped
                          ? "bg-amber-50 border-amber-200"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 ${
                          supplierBookingResult.skipped
                            ? "text-amber-600"
                            : "text-blue-600"
                        }`}
                      />
                      <div className="text-sm">
                        <p
                          className={`font-semibold ${
                            supplierBookingResult.skipped
                              ? "text-amber-700"
                              : "text-blue-700"
                          }`}
                        >
                          {supplierBookingResult.skipped
                            ? "Supplier booking already processed"
                            : "Supplier booking created (Amadeus)"}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            supplierBookingResult.skipped
                              ? "text-amber-700"
                              : "text-blue-700"
                          }`}
                        >
                          {supplierBookingResult.amadeus_order_id
                            ? `Order ID: ${supplierBookingResult.amadeus_order_id}. `
                            : ""}
                          {supplierBookingResult.pnr
                            ? `PNR: ${supplierBookingResult.pnr}.`
                            : supplierBookingResult.skipped
                              ? "No duplicate supplier booking call was made."
                              : "Order created. Ticketing can be completed in the next step."}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  Create booking from selected offer to continue payment.
                </p>
              )}
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                {error}
              </div>
            ) : null}
          </div>
        </div>
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
