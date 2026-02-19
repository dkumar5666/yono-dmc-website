import { notFound } from "next/navigation";
import { holidays } from "@/data/holidays";
import HolidayHero from "@/components/HolidayHero";
import HolidayItinerary from "@/components/HolidayItinerary";
import HolidayPackageDetails from "@/components/HolidayPackageDetails";
import HolidayPriceBox from "@/components/HolidayPriceBox";
import HolidayGallery from "@/components/HolidayGallery";

interface Props {
  params: Promise<{ slug: string }> | { slug: string };
}

export default async function HolidayDetailPage({ params }: Props) {
  const resolvedParams = "then" in params ? await params : params;
  const holiday = holidays.find(h => h.slug === resolvedParams.slug);

  if (!holiday) return notFound();

  return (
    <div className="bg-gray-50">
      <HolidayHero holiday={holiday} />

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8 py-10">
        <div className="lg:col-span-2 space-y-8">
          <HolidayGallery
            title={holiday.title}
            images={holiday.gallery && holiday.gallery.length > 0 ? holiday.gallery : [holiday.image]}
          />
          <HolidayItinerary itinerary={holiday.itinerary} />
          <HolidayPackageDetails holiday={holiday} />
        </div>

        <HolidayPriceBox holiday={holiday} />
      </div>
    </div>
  );
}
