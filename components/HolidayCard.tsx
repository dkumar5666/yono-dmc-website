import Link from "next/link";
import Image from "next/image";

interface HolidayCardProps {
  title: string;
  description: string;
  slug: string;
  duration: string;
  priceFrom: string;
  image: string;
}

function HolidayCard({
  title,
  description,
  slug,
  duration,
  priceFrom,
  image,
}: HolidayCardProps) {
  return (
    <div className="overflow-hidden border rounded-lg hover:shadow-md transition bg-white">
      <div className="relative h-48 w-full">
        <Image src={image} alt={title} fill className="object-cover" />
      </div>
      <div className="p-6">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <p className="text-sm text-gray-700 mb-1">{duration}</p>
      <p className="text-sm font-semibold text-teal-700 mb-4">{priceFrom}</p>

      <Link
        href={`/holidays/${slug}`}
        className="text-primary font-medium hover:underline"
      >
        Get Best Price &rarr;
      </Link>
      </div>
    </div>
  );
}

export default HolidayCard;
export { HolidayCard };

