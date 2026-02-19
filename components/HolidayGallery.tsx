import Image from "next/image";

interface HolidayGalleryProps {
  title: string;
  images: string[];
}

export default function HolidayGallery({ title, images }: HolidayGalleryProps) {
  if (!images.length) return null;

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="text-2xl font-semibold mb-4">{title} Gallery</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, index) => (
          <div key={`${image}-${index}`} className="relative h-48 rounded-xl overflow-hidden">
            <Image
              src={image}
              alt={`${title} image ${index + 1}`}
              fill
              className="object-cover"
              unoptimized={image.startsWith("/api/images/")}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
