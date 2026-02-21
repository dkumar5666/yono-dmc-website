import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
import { Package } from "@/data/mockData";

interface Props {
  package: Package;
}

export default function PackageCard({ package: pkg }: Props) {
  return (
    <Link href={`/holidays/${pkg.slug}`} className="block bg-white rounded-2xl shadow-md hover:shadow-xl transition group">
      <div className="relative h-56 overflow-hidden">
        <Image
          src={pkg.image}
          alt={pkg.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover group-hover:scale-110 transition"
          unoptimized={pkg.image.startsWith("/api/images/")}
        />
        <span className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm">
          {pkg.duration}
        </span>
      </div>

      <div className="p-5">
        <h3 className="text-xl font-semibold mb-1">{pkg.title}</h3>
        <p className="text-teal-600 mb-4">{pkg.destination}</p>

        <div className="space-y-2 mb-4">
          {pkg.inclusions.slice(0, 3).map((i, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-teal-500" />
              {i}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t pt-4">
          <div>
            <p className="text-sm text-gray-500">Starting from</p>
            <p className="text-2xl font-bold text-blue-900">
              &#8377;{pkg.price.toLocaleString("en-IN")}
            </p>
          </div>

          <span className="bg-primary text-white px-5 py-2.5 rounded-lg">
            View Details
          </span>
        </div>
      </div>
    </Link>
  );
}

