"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Phone } from "lucide-react";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Packages", path: "/packages" },
    { name: "Destinations", path: "/destinations" },
    { name: "Flights", path: "/flights" },
    { name: "Hotels", path: "/hotels" },
    { name: "Visa Services", path: "/visa" },
    { name: "About", path: "/about" },
    { name: "Contact", path: "/contact" },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <div className="text-3xl font-bold">
              <span className="text-blue-900">YONO</span>
              <span className="text-teal-500">DMC</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`transition-colors ${
                  isActive(link.path)
                    ? "text-teal-600 font-semibold"
                    : "text-gray-700 hover:text-teal-600"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="tel:+919876543210"
              className="flex items-center gap-2 text-gray-700 hover:text-teal-600 transition-colors"
            >
              <Phone className="w-5 h-5" />
              <span>+91 98765 43210</span>
            </a>
            <WhatsAppButton text="Enquire Now" />
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-md text-gray-700 hover:text-teal-600 hover:bg-gray-100 transition-colors"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    isActive(link.path)
                      ? "bg-teal-50 text-teal-600 font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              <div className="pt-4 px-4">
                <a
                  href="tel:+919876543210"
                  className="flex items-center gap-2 text-gray-700 mb-3"
                >
                  <Phone className="w-5 h-5" />
                  <span>+91 98765 43210</span>
                </a>
                <WhatsAppButton
                  text="Enquire Now"
                  className="w-full justify-center"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
