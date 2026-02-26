import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerPortalSession, listCustomerTrips } from "@/lib/backend/customerTripsPortal";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value?: number | null, currency?: string | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatusBadge({ label }: { label?: string | null }) {
  const text = (label || "").trim().replaceAll("_", " ") || "Not available";
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
      {text}
    </span>
  );
}

export default async function MyTripsPage() {
  const cookieStore = await cookies();
  const session = await getCustomerPortalSession(cookieStore);

  if (!session) {
    redirect("/login?next=%2Fmy-trips");
  }

  const bookings = await listCustomerTrips(session);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#199ce0]">Customer Portal</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">My Trips</h1>
          <p className="mt-2 text-sm text-slate-600">
            View your bookings, documents, and trip details in one place.
          </p>
        </div>
        <Link
          href="/holidays"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
        >
          Explore Holidays
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No trips found yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your bookings will appear here after you complete a purchase or receive a confirmed itinerary.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#148bc7]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {bookings.map((booking) => (
            <article
              key={booking.booking_id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Booking ID</p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">{booking.booking_id}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge label={booking.status} />
                    {booking.payment_status ? <StatusBadge label={booking.payment_status} /> : null}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-700 sm:text-right">
                  <p>
                    <span className="font-medium text-slate-500">Amount:</span>{" "}
                    {formatAmount(booking.total_amount, booking.currency)}
                  </p>
                  <p>
                    <span className="font-medium text-slate-500">Created:</span> {formatDate(booking.created_at)}
                  </p>
                  <div className="pt-1">
                    <Link
                      href={`/my-trips/${encodeURIComponent(booking.booking_id)}`}
                      className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#148bc7]"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

