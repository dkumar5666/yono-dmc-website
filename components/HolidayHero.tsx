import Image from "next/image";

interface Holiday {
  title: string;
  description: string;
  image: string;
}

interface HolidayHeroProps {
  holiday: Holiday;
}

export default function HolidayHero({ holiday }: HolidayHeroProps) {
  return (
    <section className="relative h-[360px] md:h-[440px] overflow-hidden">
      <Image
        src={holiday.image}
        alt={holiday.title}
        fill
        className="object-cover"
        priority

      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-800/60" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 h-full flex items-end pb-10">
        <div className="text-white max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-bold mb-3">{holiday.title}</h1>
          <p className="text-base md:text-lg text-slate-100">{holiday.description}</p>
        </div>
      </div>
    </section>
  );
}

