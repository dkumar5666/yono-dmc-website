import { notFound } from "next/navigation";
import { holidays } from "@/data/holidays";
import HolidayHero from "@/components/HolidayHero";
import HolidayItinerary from "@/components/HolidayItinerary";
import HolidayPriceBox from "@/components/HolidayPriceBox";

interface Props {
  params: { slug: string };
}

export default function HolidayDetailPage({ params }: Props) {
  const holiday = holidays.find(h => h.slug === params.slug);

  if (!holiday) return notFound();

  return (
    <div className="bg-gray-50">
      <HolidayHero holiday={holiday} />

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8 py-10">
        <div className="lg:col-span-2 space-y-8">
          <HolidayItinerary itinerary={holiday.itinerary} />
        </div>

        <HolidayPriceBox holiday={holiday} />
      </div>
    </div>
  );
}
