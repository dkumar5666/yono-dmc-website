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
    <Link
      href={`/holidays/${slug}`}
      className="block overflow-hidden border rounded-lg hover:shadow-md transition bg-white"
    >
      <div className="relative h-40 w-full">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover"
          quality={82}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
      </div>
      <div className="p-4">
      <h3 className="text-lg font-semibold mb-1.5 line-clamp-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-3 line-clamp-3">{description}</p>
      <p className="text-xs text-gray-700 mb-1">{duration}</p>
      <p className="text-xs font-semibold text-teal-700 mb-3">{priceFrom}</p>

      <span className="text-primary text-sm font-medium hover:underline">
        Get Best Price &rarr;
      </span>
      </div>
    </Link>
  );
}

export default HolidayCard;
export { HolidayCard };

