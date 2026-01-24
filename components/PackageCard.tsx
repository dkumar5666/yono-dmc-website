import Link from "next/link";
import { Check } from "lucide-react";
import { Package } from "@/data/mockData";

interface Props {
  package: Package;
}

export default function PackageCard({ package: pkg }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition group">
      <div className="relative h-56 overflow-hidden">
        <img
          src={pkg.image}
          alt={pkg.title}
          className="w-full h-full object-cover group-hover:scale-110 transition"
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
              ₹{pkg.price.toLocaleString("en-IN")}
            </p>
          </div>

          <Link
            href={`/holidays/${pkg.slug}`}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
