import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { holidays } from "@/data/holidays";

interface Props {
  params: Promise<{ slug: string }> | { slug: string };
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function DestinationPackagesPage({ params }: Props) {
  const resolvedParams = "then" in params ? await params : params;
  const destinationSlug = resolvedParams.slug;
  const filtered = holidays.filter((item) => toSlug(item.country) === destinationSlug);

  if (filtered.length === 0) return notFound();

  const destinationName = filtered[0].country;

  return (
    <section className="max-w-6xl mx-auto px-6 py-14">
      <h1 className="text-3xl md:text-4xl font-bold mb-3">{destinationName} Packages</h1>
      <p className="text-gray-600 mb-8">
        Choose a package below to view complete itinerary, hotel details, and booking options.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {filtered.map((pkg) => (
          <Link key={pkg.slug} href={`/holidays/${pkg.slug}`} className="block">
            <article className="border rounded-xl bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row">
                <div className="relative h-44 sm:h-auto sm:w-52 sm:shrink-0">
                  <Image
                    src={pkg.image}
                    alt={pkg.title}
                    fill
                    className="object-cover"
                    unoptimized={pkg.image.startsWith("/api/images/")}
                  />
                </div>
                <div className="p-6 flex-1">
                <h2 className="text-xl font-semibold mb-2">{pkg.title}</h2>
                <p className="text-sm text-gray-600 mb-3">{pkg.duration}</p>
                <p className="text-gray-700 mb-4">{pkg.description}</p>
                <p className="text-sm font-semibold text-teal-700 mb-4">{pkg.priceFrom}</p>
                <span className="inline-flex items-center bg-[#f5991c] text-white px-4 py-2 rounded-lg font-medium">
                  View Full Package
                </span>
              </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
