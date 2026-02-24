import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
  Ticket,
  XCircle,
} from "lucide-react";
import { getAttractionsCatalog } from "@/lib/backend/attractionsStore";

interface Props {
  params: Promise<{ slug: string }> | { slug: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const resolved = "then" in params ? await params : params;
  const catalog = await getAttractionsCatalog();
  const activity = catalog.attractions.find((item) => item.slug === resolved.slug);

  if (!activity) {
    return {
      title: "Attraction not found | Yono DMC",
    };
  }

  return {
    title: `${activity.title} | Yono DMC`,
    description: activity.description,
  };
}

export default async function AttractionDetailsPage({ params }: Props) {
  const resolved = "then" in params ? await params : params;
  const catalog = await getAttractionsCatalog();
  const activity = catalog.attractions.find((item) => item.slug === resolved.slug);

  if (!activity) return notFound();

  const relatedActivities = catalog.attractions
    .filter((item) => item.slug !== activity.slug)
    .sort(
      (a, b) =>
        Number(b.countryKey === activity.countryKey && b.category === activity.category) -
        Number(a.countryKey === activity.countryKey && a.category === activity.category)
    )
    .slice(0, 4);

  const buildPackageLink = `/build-package?destination=${encodeURIComponent(activity.countryName)}&activity=${encodeURIComponent(activity.title)}`;
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(activity.mapQuery)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <Link href="/things-to-do" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#199ce0]">
            <ArrowLeft className="h-4 w-4" />
            Back to Attractions
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="relative h-72 w-full md:h-96">
              <Image
                src={activity.image}
                alt={activity.title}
                fill
                className="object-cover"

                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="inline-flex rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700">
                  {activity.category}
                </span>
                <h1 className="mt-2 text-2xl font-bold text-white md:text-4xl">{activity.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/95">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-[#f5991c] text-[#f5991c]" />
                    {activity.rating} ({activity.reviews.toLocaleString("en-IN")} reviews)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {activity.countryName}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {activity.location}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <h2 className="text-lg font-bold text-slate-900">Overview</h2>
                <p className="mt-2 leading-7 text-slate-700">{activity.description}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Top cities covered in this destination: {activity.cities.join(", ")}.
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Clock3 className="h-4 w-4 text-[#199ce0]" />
                    {activity.duration}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Best Timing</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CalendarClock className="h-4 w-4 text-[#199ce0]" />
                    {activity.timing}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting Point</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-[#199ce0]" />
                    {activity.meetingPoint}
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-slate-900">Highlights</h2>
                <ul className="mt-3 space-y-2">
                  {activity.highlights.map((item) => (
                    <li key={item} className="inline-flex w-full items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#199ce0]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-base font-bold text-slate-900">Inclusions</h3>
                  <ul className="mt-3 space-y-2">
                    {activity.inclusions.map((item) => (
                      <li key={item} className="inline-flex w-full items-start gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="text-base font-bold text-slate-900">Exclusions</h3>
                  <ul className="mt-3 space-y-2">
                    {activity.exclusions.map((item) => (
                      <li key={item} className="inline-flex w-full items-start gap-2 text-sm text-slate-700">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="inline-flex items-center gap-2 text-base font-bold text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-[#199ce0]" />
                  Cancellation Policy
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-700">{activity.cancellationPolicy}</p>
              </section>
            </div>
          </article>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Location Map</h2>
            </div>
            <div className="h-72 w-full">
              <iframe
                title={`${activity.title} map`}
                src={mapEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-900">Book This Experience</h2>
            <p className="mt-2 text-sm text-slate-600">
              Lock your slot with guided support, best available pricing, and confirmed booking assistance.
            </p>
            <div className="mt-4 space-y-3">
              <a
                href={activity.ticketsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#5ab546] px-4 text-sm font-semibold text-white"
              >
                <Ticket className="h-4 w-4" />
                Book Tickets
              </a>
              <Link
                href={buildPackageLink}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#199ce0] px-4 text-sm font-semibold text-[#199ce0]"
              >
                Add to Custom Package
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-bold text-slate-900">Need help before booking?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Our team can help with slots, age policy, transfer options, and bundled package pricing.
            </p>
            <Link
              href="/support"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-[#199ce0] text-sm font-semibold text-white"
            >
              Contact Support
            </Link>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-bold text-slate-900">Similar Experiences</h3>
            <div className="mt-4 space-y-3">
              {relatedActivities.map((item) => (
                <Link
                  key={item.slug}
                  href={item.detailsHref}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 hover:border-[#199ce0]"
                >
                  <div className="relative h-14 w-14 overflow-hidden rounded-lg">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover"

                    />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

