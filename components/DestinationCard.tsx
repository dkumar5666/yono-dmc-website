import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Destination } from "@/data/mockData";

interface Props {
  destination: Destination;
}

export default function DestinationCard({ destination }: Props) {
  return (
    <Link href="/packages" className="group block">
      <div className="relative h-80 rounded-2xl overflow-hidden shadow-lg">
        <Image
          src={destination.image}
          alt={destination.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 p-6 text-white w-full">
          <h3 className="text-3xl font-bold mb-2">{destination.name}</h3>
          <p className="text-gray-200 mb-3">{destination.tagline}</p>

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
