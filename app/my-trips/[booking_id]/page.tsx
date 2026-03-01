import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerPortalSession, getCustomerTripDetail } from "@/lib/backend/customerTripsPortal";
import { requirePortalRole } from "@/lib/auth/requirePortalRole";
import { getCustomerProfileCompletionStatus } from "@/lib/backend/customerAccount";

export const dynamic = "force-dynamic";

type Params = { booking_id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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
  const text = safeString(label).replaceAll("_", " ") || "Not available";
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
      {text}
    </span>
  );
}

function normalizeDocumentType(value: string): "invoice" | "booking_confirmation" | "itinerary_summary" | "other" {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  if (normalized === "invoice") return "invoice";
  if (normalized === "voucher" || normalized === "booking_confirmation") return "booking_confirmation";
  if (normalized === "itinerary" || normalized === "itinerary_summary") return "itinerary_summary";
  return "other";
}

export default async function MyTripDetailPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const resolved = "then" in params ? await params : params;
  const bookingParam = decodeURIComponent(resolved.booking_id ?? "").trim();
  await requirePortalRole("customer", {
    loginPath: "/login",
    nextPath: `/my-trips/${encodeURIComponent(bookingParam)}`,
  });

  const cookieStore = await cookies();
  const session = await getCustomerPortalSession(cookieStore);

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/my-trips/${bookingParam}`)}`);
  }
  if (session.provider === "supabase" && !session.phone) {
    redirect(`/login?next=${encodeURIComponent(`/my-trips/${bookingParam}`)}&require_mobile_otp=1`);
  }
  if (session.provider === "supabase") {
    const profileCompleted = await getCustomerProfileCompletionStatus(session.id);
    if (!profileCompleted) {
      redirect("/account/onboarding");
    }
  }

  const detail = await getCustomerTripDetail(session, bookingParam);
  const booking = detail.booking;
  const requiredDocs = [
    { key: "invoice" as const, label: "Invoice" },
    { key: "booking_confirmation" as const, label: "Booking Confirmation (Voucher)" },
    { key: "itinerary_summary" as const, label: "Itinerary Summary" },
  ];
  const docsByType = new Map<
    "invoice" | "booking_confirmation" | "itinerary_summary",
    (typeof detail.documents)[number]
  >();
  for (const doc of detail.documents) {
    const normalizedType = normalizeDocumentType(safeString(doc.type));
    if (normalizedType === "other") continue;
    if (!docsByType.has(normalizedType)) {
      docsByType.set(normalizedType, doc);
    }
  }

  if (!booking) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Booking not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            We could not find this booking in your account, or you may not have access to it.
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

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Booking {booking.booking_id}
            </h1>
            {booking.status ? <StatusBadge label={booking.status} /> : null}
            {booking.payment_status ? <StatusBadge label={booking.payment_status} /> : null}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Review your booking details and download available travel documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/my-trips/${encodeURIComponent(booking.booking_id)}/support`}
            className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#148bc7]"
          >
            Need help?
          </Link>
          <Link
            href="/my-trips"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
          >
            Back to My Trips
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Amount</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatAmount(booking.total_amount, booking.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Created</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(booking.created_at)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Payment Status</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {safeString(booking.payment_status).replaceAll("_", " ") || "Not available"}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-900">Documents</h2>
          <p className="text-xs text-slate-500">Download invoices, vouchers, itinerary and tickets if available.</p>
        </div>
        <div className="space-y-2">
          {requiredDocs.map((docMeta) => {
            const doc = docsByType.get(docMeta.key);
            const status = safeString(doc?.status).toLowerCase();
            const hasUrl = Boolean(safeString(doc?.url));
            const isPending =
              !doc ||
              !hasUrl ||
              status === "pending" ||
              status === "failed" ||
              status === "generating";

            return (
              <div
                key={docMeta.key}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={docMeta.label} />
                    <p className="truncate text-sm font-medium text-slate-900">
                      {safeString(doc?.name) || docMeta.label}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {doc ? formatDate(doc.created_at) : "Generating… please check later"}
                  </p>
                </div>

                {!isPending && safeString(doc?.url) ? (
                  <a
                    href={doc.url!}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#148bc7]"
                  >
                    Open
                  </a>
                ) : (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    Generating… please check later
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-900">Trip Items</h2>
          <p className="text-xs text-slate-500">Flights, stays, transfers, activities, or package components.</p>
        </div>

        {detail.items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No item details available for this booking yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Title</th>
                  <th className="px-3 py-3 font-semibold">Dates</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, index) => (
                  <tr key={`${item.id ?? "item"}-${index}`} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-700">{safeString(item.type) || "-"}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{safeString(item.title) || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">
                      <div>{formatDate(item.start_date)}</div>
                      <div className="text-xs text-slate-400">{formatDate(item.end_date)}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatAmount(item.amount, item.currency)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge label={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
