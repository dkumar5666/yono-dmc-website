"use client";

import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          
          {/* LOGO */}
          <Link href="/" className="flex items-center">
  <div className="relative h-10 w-[140px]">
    <Image
      src="/logo.png"
      alt="Yono DMC Logo"
      fill
      className="object-contain"
      priority
    />
  </div>
</Link>

          {/* NAVIGATION */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-700">
            <Link href="/" className="hover:text-primary">Home</Link>
            <Link href="/packages" className="hover:text-primary">Packages</Link>
            <Link href="/destinations" className="hover:text-primary">Destinations</Link>
            <Link href="/flights" className="hover:text-primary">Flights</Link>
            <Link href="/hotels" className="hover:text-primary">Hotels</Link>
            <Link href="/visa" className="hover:text-primary">Visa</Link>
            <Link href="/about" className="hover:text-primary">About</Link>
            <Link href="/contact" className="hover:text-primary">Contact</Link>
          </nav>

          {/* RIGHT SIDE CTA */}
          <div className="hidden lg:flex items-center gap-6">
            <a
              href="tel:+919958839319"
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary"
            >
              <Phone className="w-4 h-4" />
              +91 99588 39319
            </a>

            <WhatsAppButton text="Enquire Now" />
          </div>
        </div>
      </div>
    </header>
  );
}
