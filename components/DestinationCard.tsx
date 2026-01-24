import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Destination } from "@/data/mockData";

interface DestinationCardProps {
  destination: Destination;
}

export function DestinationCard({ destination }: DestinationCardProps) {
  return (
    <Link href="/packages" className="group block">
      <div className="relative h-80 rounded-2xl overflow-hidden shadow-lg">
        <img
          src={destination.image}
          alt={destination.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 p-6 text-white w-full">
          <h3 className="text-3xl font-bold mb-2">
            {destination.name}
          </h3>

          <p className="text-gray-200 mb-3">
            {destination.tagline}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">
              {destination.packages} Packages Available
            </span>

            <span className="flex items-center gap-2 text-amber-400 group-hover:gap-3 transition-all">
              <span className="font-medium">Explore</span>
              <ArrowRight className="w-5 h-5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
