import Image from "next/image";
import Link from "next/link";
import {
  Home,
  Plane,
  Hotel,
  Landmark,
  Palmtree,
  FileText,
} from "lucide-react";

export default function Header() {
  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-[88px] py-1 flex items-center justify-between">
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

        <nav className="hidden md:flex gap-7 text-[17px] font-medium text-gray-700">
          <Link href="/" className="inline-flex items-center gap-1.5">
            <Home size={20} /> Home
          </Link>
          <Link href="/flights" className="inline-flex items-center gap-1.5">
            <Plane size={20} /> Flights
          </Link>
          <Link href="/hotels" className="inline-flex items-center gap-1.5">
            <Hotel size={20} /> Hotels
          </Link>
          <Link href="/attractions" className="inline-flex items-center gap-1.5">
            <Landmark size={20} /> Attractions
          </Link>
          <Link href="/holidays" className="inline-flex items-center gap-1.5">
            <Palmtree size={20} /> Holidays
          </Link>
          <Link href="/visa" className="inline-flex items-center gap-1.5">
            <FileText size={20} /> Visa
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/admin/login"
            className="hidden md:inline-flex bg-[#199ce0] text-white px-4 py-2 rounded-full text-[17px] font-semibold hover:opacity-90"
          >
            Login / Signup
          </Link>
          <a
            href="https://wa.me/919958839319"
            target="_blank"
            rel="noreferrer"
            className="inline-flex bg-[#25d366] text-white px-4 py-2 rounded-full text-[17px] font-semibold hover:opacity-90"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}
