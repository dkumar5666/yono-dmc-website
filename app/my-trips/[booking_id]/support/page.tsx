import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TripSupportRequestForm from "@/components/customer/TripSupportRequestForm";
import { getCustomerPortalSession, getCustomerTripDetail } from "@/lib/backend/customerTripsPortal";
import { requirePortalRole } from "@/lib/auth/requirePortalRole";

export const dynamic = "force-dynamic";

type Params = { booking_id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateTime(value?: string | null): string {
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

export default async function MyTripSupportPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const resolved = "then" in params ? await params : params;
  const bookingParam = decodeURIComponent(resolved.booking_id ?? "").trim();
  await requirePortalRole("customer", {
    loginPath: "/login",
    nextPath: `/my-trips/${encodeURIComponent(bookingParam)}/support`,
  });

  const cookieStore = await cookies();
  const session = await getCustomerPortalSession(cookieStore);
  const bookingHref = `/my-trips/${encodeURIComponent(bookingParam)}`;

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`${bookingHref}/support`)}`);
  }
  if (session.provider === "supabase" && !session.phone) {
    redirect(`/login?next=${encodeURIComponent(`${bookingHref}/support`)}&require_mobile_otp=1`);
  }

  const detail = await getCustomerTripDetail(session, bookingParam);
  if (!detail.booking) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Booking not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            We could not verify this booking in your account, so support ticket creation is unavailable.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/my-trips"
              className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#148bc7]"
            >
              Back to My Trips
            </Link>
            <Link
              href="/support"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const booking = detail.booking;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#199ce0]">Booking Support</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Need help with {safeString(booking.booking_id) || "your booking"}?
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Submit a request linked to this booking so our team can resolve it faster.
            </p>
          </div>
          <Link
            href={bookingHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Back to Booking
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Booking ID</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {safeString(booking.booking_id) || "Not available"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Status</p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
              {(safeString(booking.status) || "Not available").replaceAll("_", " ")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Created</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(booking.created_at)}</p>
          </div>
        </div>
      </div>

      <TripSupportRequestForm bookingId={bookingParam} backHref={bookingHref} />
    </section>
  );
}
