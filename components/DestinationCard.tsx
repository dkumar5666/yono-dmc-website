import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Destination } from "@/data/mockData";

interface Props {
  destination: Destination;
  href?: string;
}

export default function DestinationCard({ destination, href }: Props) {
  const country = destination.country ?? destination.name;
  const cities =
    destination.cities && destination.cities.length > 0
      ? destination.cities.join(", ")
      : destination.tagline;

  return (
    <Link href={href ?? "/holidays"} className="group block">
      <div className="relative h-80 rounded-2xl overflow-hidden shadow-lg">
        <Image
          src={destination.image}
          alt={destination.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover group-hover:scale-110 transition-transform duration-500"
          unoptimized={destination.image.startsWith("/api/images/")}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 p-6 text-white w-full">
          <h3 className="text-3xl font-bold mb-1">{country}</h3>
          <p className="text-gray-200 mb-3 text-sm">
            <span className="font-semibold">Cities:</span> {cities}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">
              {destination.packages} Packages Available
            </span>
            <span className="flex items-center gap-2 text-amber-400">
              Explore <ArrowRight className="w-5 h-5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
