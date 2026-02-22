"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Info, Luggage, Plane } from "lucide-react";

interface BookingRecord {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
}

type GuestView = "landing" | "lookup";

export default function TripsPage() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestView, setGuestView] = useState<GuestView>("landing");
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [itineraryNumber, setItineraryNumber] = useState("");
  const [lookupResult, setLookupResult] = useState<BookingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (!me.ok) {
          setIsLoggedIn(false);
          return;
        }

        setIsLoggedIn(true);
        const tripsRes = await fetch("/api/customer/trips", { cache: "no-store" });
        const tripsData = (await tripsRes.json()) as {
          data?: { bookings?: BookingRecord[] };
        };
        if (tripsRes.ok) {
          setBookings(tripsData.data?.bookings ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onLookupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setLookupResult(null);
    try {
      const response = await fetch("/api/trips/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, itineraryNumber }),
      });
      const data = (await response.json()) as {
        data?: { booking?: BookingRecord };
        error?: { message?: string };
      };
      if (!response.ok || !data.data?.booking) {
        throw new Error(data.error?.message ?? "No booking found.");
      }
      setLookupResult(data.data.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No booking found.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="max-w-5xl mx-auto px-4 py-14">
        <p className="text-slate-600">Loading trips...</p>
      </section>
    );
  }

  if (isLoggedIn) {
    return (
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-slate-900">Your Trips</h1>
        <p className="text-slate-600 mt-2">Track bookings, payment status, and trip references.</p>

        {bookings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-slate-700">No trips found for your account yet.</p>
            <Link
              href="/flights"
              className="mt-4 inline-flex rounded-full bg-[#199ce0] px-5 py-2.5 text-white font-semibold"
            >
              Book your first trip
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {bookings.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Itinerary Number</p>
                    <h2 className="text-xl font-semibold text-slate-900">{item.reference}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium capitalize text-slate-700">
                    {item.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm text-slate-700">
                  <p>
                    <span className="text-slate-500">Booked on:</span>{" "}
                    {new Date(item.createdAt).toLocaleDateString("en-IN")}
                  </p>
                  <p>
                    <span className="text-slate-500">Amount:</span> {item.currency}{" "}
                    {item.amount.toLocaleString("en-IN")}
                  </p>
                  <p>
                    <span className="text-slate-500">Contact:</span> {item.contact.email}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-bold text-slate-900">Trips</h1>

      {guestView === "landing" ? (
        <div className="mt-8 max-w-2xl">
          <div className="mx-auto h-36 w-36 rounded-full bg-blue-50 flex items-center justify-center">
            <Luggage className="h-16 w-16 text-[#199ce0]" />
          </div>

          <h2 className="mt-10 text-2xl font-semibold text-slate-900">
            Your next adventure awaits when you sign in!
          </h2>
          <ul className="mt-4 space-y-2 text-slate-700">
            <li>Save money with member pricing on hotels, activities, and flights.</li>
            <li>Manage your trip details in one place.</li>
            <li>Track payment and booking status anytime.</li>
          </ul>

          <Link
            href="/login?next=%2Ftrips"
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#199ce0] px-5 py-3 text-white font-semibold"
          >
            Sign in or create an account
          </Link>

          <button
            type="button"
            onClick={() => setGuestView("lookup")}
            className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left"
          >
            <span className="flex items-center justify-between text-slate-900 font-semibold">
              Don&apos;t have an account?
              <ChevronRight className="h-5 w-5" />
            </span>
            <span className="mt-1 block text-slate-600">
              Use your itinerary number and email to find a booking
            </span>
          </button>
        </div>
      ) : (
        <div className="mt-8 max-w-2xl">
          <div className="rounded-2xl border border-slate-300 bg-white p-4">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <p className="text-slate-700">
                  To manage your booking and see full details, create an account or access your
                  booking from the secure link in your confirmation email.
                </p>
                <div className="mt-2 flex gap-5">
                  <Link href="/login?next=%2Ftrips" className="text-[#199ce0] font-medium">
                    Sign in
                  </Link>
                  <Link href="/login?next=%2Ftrips" className="text-[#199ce0] font-medium">
                    Create an account
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setGuestView("landing");
              setError(null);
              setLookupResult(null);
            }}
            className="mt-6 inline-flex items-center gap-2 text-[#199ce0] font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>

          <h2 className="mt-6 text-4xl font-bold text-slate-900">Find your booking</h2>
          <p className="mt-6 text-2xl font-semibold text-slate-900">
            Enter the details used for your booking
          </p>
          <p className="mt-2 text-slate-600">Asterisk &quot;*&quot; indicates a required field.</p>

          <form onSubmit={onLookupSubmit} className="mt-4 space-y-3">
            <input
              type="email"
              required
              placeholder="Email address *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg"
            />
            <input
              type="text"
              required
              placeholder="Itinerary number *"
              value={itineraryNumber}
              onChange={(e) => setItineraryNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg uppercase"
            />
            <Link
              href="/trips/forgot-itinerary"
              className="inline-block text-[#199ce0] underline text-sm"
            >
              Forgot your itinerary number?
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#199ce0] px-5 py-3 text-white font-semibold disabled:opacity-60"
            >
              {busy ? "Checking..." : "Continue"}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
              {error}
            </div>
          )}

          {lookupResult && (
            <article className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-800">
                <Plane className="h-4 w-4" />
                <p className="font-semibold">Booking found</p>
              </div>
              <p className="mt-2 text-slate-800">
                Itinerary: <span className="font-semibold">{lookupResult.reference}</span>
              </p>
              <p className="text-slate-800 capitalize">
                Status: {lookupResult.status.replaceAll("_", " ")}
              </p>
              <p className="text-slate-800">
                Amount: {lookupResult.currency} {lookupResult.amount.toLocaleString("en-IN")}
              </p>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
