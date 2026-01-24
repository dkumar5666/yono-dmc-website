import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Yono DMC Logo"
            width={120}
            height={40}
            className="object-contain"
            priority
          />
        </Link>

        <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-700">
          <Link href="/">Home</Link>
          <Link href="/packages">Packages</Link>
          <Link href="/destinations">Destinations</Link>
          <Link href="/flights">Flights</Link>
          <Link href="/hotels">Hotels</Link>
          <Link href="/visa">Visa</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        <div className="flex items-center gap-4">
          <span className="hidden md:block text-sm">+91 99588 39319</span>
          <Link
            href="/contact"
            className="bg-[#f5991c] text-white px-5 py-2 rounded-full text-sm font-semibold"
          >
            Enquire Now
          </Link>
        </div>
      </div>
    </header>
  );
}
