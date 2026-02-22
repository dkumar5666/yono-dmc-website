import Image from "next/image";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
  AtSign,
  Youtube,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 text-base">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="mb-4">
              <Image
                src="/logo.png"
                alt="Yono DMC Logo"
                width={140}
                height={48}
                className="object-contain"
              />
            </div>
            <p className="text-base mb-4">
              Your trusted destination management company for unforgettable
              international holidays.
            </p>
            <div className="flex gap-5">
              <a
                className="text-[#199ce0] hover:text-[#f5991c] transition-colors"
                href="https://www.facebook.com/yonodmc.in"
                target="_blank"
                rel="noreferrer"
              >
                <Facebook className="w-7 h-7" />
              </a>
              <a
                className="text-[#199ce0] hover:text-[#f5991c] transition-colors"
                href="https://www.instagram.com/yonodmc/"
                target="_blank"
                rel="noreferrer"
              >
                <Instagram className="w-7 h-7" />
              </a>
              <a
                className="text-[#199ce0] hover:text-[#f5991c] transition-colors"
                href="https://x.com/yonodmc"
                target="_blank"
                rel="noreferrer"
                aria-label="X"
              >
                <Twitter className="w-7 h-7" />
              </a>
              <a
                className="text-[#199ce0] hover:text-[#f5991c] transition-colors"
                href="https://www.threads.com/@yonodmc"
                target="_blank"
                rel="noreferrer"
                aria-label="Threads"
              >
                <AtSign className="w-7 h-7" />
              </a>
              <a
                className="text-[#199ce0] hover:text-[#f5991c] transition-colors"
                href="https://www.youtube.com/@yonodmcc"
                target="_blank"
                rel="noreferrer"
              >
                <Youtube className="w-7 h-7" />
              </a>
            </div>
          </div>

          {/* Main Pages */}
          <div>
            <h3 className="text-white font-semibold text-xl mb-4">Main Pages</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/holidays">Packages</Link>
              </li>
              <li>
                <Link href="/flights">Flights</Link>
              </li>
              <li>
                <Link href="/hotels">Stays</Link>
              </li>
              <li>
                <Link href="/visa">Visa Services</Link>
              </li>
              <li>
                <Link href="/destinations">Destinations</Link>
              </li>
            </ul>
          </div>

          {/* More Links */}
          <div>
            <h3 className="text-white font-semibold text-xl mb-4">More Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/travel-tips-guides">Travel Tips & Guides</Link>
              </li>
              <li>
                <Link href="/customer-reviews">Customer Reviews</Link>
              </li>
              <li>
                <Link href="/feedback">Survey & Feedback</Link>
              </li>
              <li>
                <Link href="/about">About Us</Link>
              </li>
              <li>
                <Link href="/contact">Contact Us</Link>
              </li>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms-and-conditions">Terms & Conditions</Link>
              </li>
              <li>
                <Link href="/cookie-policy">Cookie Policy</Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold text-xl mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="w-7 h-7 mt-0.5 shrink-0 text-[#199ce0]" />
                <a
                  href="https://share.google/5epho29t1iMGwnbUz"
                  target="_blank"
                  rel="noreferrer"
                  className="text-base hover:underline"
                >
                  Unit No. 259, 2nd Floor, Tower No. B1, SPAZE ITECH PARK,
                  Badshahpur Sohna Rd, Sector 49, Gurugram, Haryana 122018
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-7 h-7 shrink-0 text-[#199ce0]" />
                <a
                  href="https://share.google/5epho29t1iMGwnbUz"
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Google Maps
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-7 h-7 shrink-0 text-[#f5991c]" />
                <a href="tel:+919958839319">+91 99588 39319</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-7 h-7 shrink-0 text-[#f5991c]" />
                <a href="mailto:info@yonodmc.in">info@yonodmc.in</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-base">
          <p>&copy; {new Date().getFullYear()} Yono DMC. All rights reserved.</p>
          <div className="mt-2">
            <Link href="/terms-and-conditions">Terms & Conditions</Link>
            <span className="mx-2">|</span>
            <Link href="/privacy-policy">Privacy Policy</Link>
            <span className="mx-2">|</span>
            <Link href="/cookie-policy">Cookie Policy</Link>
            <span className="mx-2">|</span>
            <Link href="/refund-policy">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
