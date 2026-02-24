"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plane,
  BedSingle,
  Map,
  Package,
  TrainFront,
  CarFront,
  Bus,
  FileText,
  Banknote,
  Ship,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

const currencies = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "AED", name: "U.A.E. Dirham" },
  { code: "IDR", name: "Indonesian Rupiah" },
];

const headerTabs = [
  { label: "Flights", href: "/flights", icon: Plane },
  { label: "Stays", href: "/hotels", icon: BedSingle },
  { label: "Attractions", href: "/things-to-do", icon: Map },
  { label: "Holidays", href: "/holidays", icon: Package },
  { label: "Trains", href: "/trains", icon: TrainFront },
  { label: "Bus", href: "/bus", icon: Bus },
  { label: "Cabs", href: "/cabs", icon: CarFront },
  { label: "Visa", href: "/visa", icon: FileText },
  { label: "Forex", href: "/forex", icon: Banknote },
  { label: "Cruise", href: "/cruise", icon: Ship },
  { label: "Insurance", href: "/insurance", icon: ShieldCheck },
];

export default function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [homeScrolled, setHomeScrolled] = useState(false);
  const HEADER_HEIGHT = 74;
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

  useEffect(() => {
    if (!isHome) return;
    const handleScroll = () => {
      const widget = document.getElementById("home-booking-engine-widget");
      if (!widget) {
        setHomeScrolled(window.scrollY > 420);
        return;
      }
      const rect = widget.getBoundingClientRect();
      // Show header categories exactly when widget passes under sticky header.
      setHomeScrolled(rect.bottom <= HEADER_HEIGHT + 2);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isHome]);

  const showCategoryNav = !isHome || homeScrolled;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid h-[84px] w-full max-w-[1280px] grid-cols-[auto_1fr_auto] items-center gap-x-3 px-4 md:gap-x-4 md:px-6 xl:grid-cols-[210px_minmax(0,1fr)_300px]">
        <Link href="/" className="shrink-0 pr-4 md:pr-6 xl:pr-10">
          <Image
            src="/logo.png"
            alt="Yono DMC Logo"
            width={116}
            height={39}
            className="h-auto w-[106px] object-contain md:w-[116px]"
            priority
          />
        </Link>

        {showCategoryNav ? (
          <nav className="col-start-2 hidden min-w-0 xl:block xl:pl-3">
            <div className="grid grid-cols-11 items-start justify-items-center gap-x-0.5 pb-1">
              {headerTabs.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const attractionHolidayGapClass =
                  item.label === "Attractions"
                    ? "xl:mr-1"
                    : item.label === "Holidays"
                    ? "xl:ml-1"
                    : "";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative inline-flex h-[56px] w-full max-w-[86px] shrink-0 flex-col items-center justify-start gap-0.5 rounded-md px-1 py-0.5 text-[12px] font-medium leading-[12px] transition ${attractionHolidayGapClass} ${
                      active
                        ? "text-[#199ce0]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className="inline-flex h-[23px] w-[23px] items-center justify-center">
                      <Icon
                        className={`h-5 w-5 ${
                          active
                            ? "text-[#199ce0]"
                            : "text-slate-500 group-hover:text-slate-700"
                        }`}
                      />
                    </span>
                    <span className="inline-flex h-[24px] w-full items-start justify-center text-center whitespace-nowrap">
                      {item.label}
                    </span>
                    <span
                      className={`absolute -bottom-1 left-1.5 right-1.5 h-0.5 rounded-full transition ${
                        active
                          ? "bg-[#199ce0]"
                          : "bg-transparent group-hover:bg-slate-300"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : (
          <div className="col-start-2 hidden xl:block" />
        )}

        <div className="col-start-3 flex items-center justify-end">
          <div className="hidden items-center gap-5 text-[13.5px] font-medium text-slate-700 lg:flex">
            <Link href="/support" className="hover:text-slate-900">
              Support
            </Link>
            <Link href="/trips" className="hover:text-slate-900">
              My Trips
            </Link>
            <Link href="/login" className="hover:text-slate-900">
              Sign in
            </Link>

            <div className="relative group">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 hover:text-slate-900"
              >
                <span>{selectedCurrency.code}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="invisible absolute right-0 top-full z-50 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {currencies.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setSelectedCurrency(item)}
                      className="inline-flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-slate-800 hover:bg-slate-50"
                    >
                      <span className="font-medium">{item.code}</span>
                      <span className="text-sm text-slate-500">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              href="/login"
              className="inline-flex rounded-full bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Login
            </Link>
            <a
              href="https://wa.me/919958839319"
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
