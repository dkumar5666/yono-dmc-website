import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Holiday Packages",
  description:
    "Explore domestic and international holiday packages including Dubai, Bali, Singapore and Malaysia with Yono DMC.",
};
import { holidays } from "@/data/holidays";
import HolidayCard from "@/components/HolidayCard";

export default function HolidaysPage() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-4">Holiday Packages</h1>
      <p className="text-gray-600 mb-10">
        Discover handpicked domestic and international holiday packages by Yono DMC.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {holidays.map((item) => (
          <HolidayCard
            key={item.slug}
            title={item.title}
            description={item.description}
            slug={item.slug}
            duration={item.duration}
            priceFrom={item.priceFrom}
            image={item.image}
          />
        ))}
      </div>
    </section>
  );
}
