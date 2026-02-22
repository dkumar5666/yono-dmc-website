"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plane,
  Hotel,
  Landmark,
  Palmtree,
  ChevronDown,
  Globe,
  Briefcase,
  LifeBuoy,
  LogIn,
  LayoutGrid,
} from "lucide-react";

const currencies = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AED", name: "U.A.E. Dirham" },
  { code: "IDR", name: "Indonesian Rupiah" },
];

export default function Header() {
  const [selectedCurrency, setSelectedCurrency] = useState(() => {
    if (typeof window === "undefined") return currencies[0];
    try {
      const saved = window.localStorage.getItem("yono_currency");
      const found = currencies.find((item) => item.code === saved);
      return found ?? currencies[0];
    } catch {
      return currencies[0];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("yono_currency", selectedCurrency.code);
    } catch {
      // ignore storage errors
    }
  }, [selectedCurrency]);

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-[72px] flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="Yono DMC Logo"
              width={90}
              height={28}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-7 text-[16px] font-medium text-gray-700">
          <Link href="/support" className="inline-flex items-center gap-1.5 hover:text-black">
            <LifeBuoy size={16} className="text-[#199ce0]" />
            Support
          </Link>
          <Link href="/trips" className="inline-flex items-center gap-1.5 hover:text-black">
            <Briefcase size={16} className="text-[#199ce0]" />
            My Trips
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 hover:text-black">
            <LogIn size={16} className="text-[#199ce0]" />
            Sign in
          </Link>

          <div className="relative group">
            <button type="button" className="inline-flex items-center gap-2 hover:text-black">
              <Globe size={16} className="text-[#199ce0]" />
              <span className="text-[16px]">{selectedCurrency.code}</span>
              <ChevronDown size={16} />
            </button>
            <div className="absolute right-0 top-full pt-3 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition">
              <div className="w-56 rounded-xl border border-gray-200 bg-white shadow-xl p-2">
                {currencies.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setSelectedCurrency(item)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-800 inline-flex items-center justify-between gap-3"
                  >
                    <span className="font-medium">{item.code}</span>
                    <span className="text-slate-500 text-sm">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative group">
            <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-1">
              <button
                type="button"
                aria-label="Open home travel menu"
                className="inline-flex h-8 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 hover:from-slate-100 hover:to-slate-200"
              >
                <LayoutGrid size={17} strokeWidth={2.2} />
              </button>
            </div>
            <div className="absolute right-0 top-full pt-3 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition">
              <div className="w-64 rounded-xl border border-gray-200 bg-white shadow-xl p-2">
                <Link href="/hotels" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-800">
                  <Hotel size={18} className="text-[#199ce0]" />
                  Stays
                </Link>
                <Link href="/flights" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-800">
                  <Plane size={18} className="text-[#199ce0]" />
                  Flights
                </Link>
                <Link href="/holidays" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-800">
                  <Palmtree size={18} className="text-[#199ce0]" />
                  Packages
                </Link>
                <Link href="/attractions" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-800">
                  <Landmark size={18} className="text-[#199ce0]" />
                  Things To Do
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex lg:hidden items-center gap-3">
          <Link
            href="/login"
            className="inline-flex bg-[#199ce0] text-white px-4 py-2 rounded-full text-[16px] font-semibold hover:opacity-90"
          >
            Login
          </Link>
          <a
            href="https://wa.me/919958839319"
            target="_blank"
            rel="noreferrer"
            className="inline-flex bg-[#25d366] text-white px-4 py-2 rounded-full text-[16px] font-semibold hover:opacity-90"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}
