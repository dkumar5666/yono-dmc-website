import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="text-2xl font-bold mb-4">
              <span className="text-white">YONO</span>
              <span className="text-teal-400">DMC</span>
            </div>
            <p className="text-sm mb-4">
              Your trusted destination management company for unforgettable
              international holidays.
            </p>
            <div className="flex gap-4">
              <a className="hover:text-teal-400 transition-colors" href="#">
                <Facebook className="w-5 h-5" />
              </a>
              <a className="hover:text-teal-400 transition-colors" href="#">
                <Instagram className="w-5 h-5" />
              </a>
              <a className="hover:text-teal-400 transition-colors" href="#">
                <Twitter className="w-5 h-5" />
              </a>
              <a className="hover:text-teal-400 transition-colors" href="#">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li><Link href="/packages">Holiday Packages</Link></li>
              <li><Link href="/destinations">Destinations</Link></li>
              <li><Link href="/flights">Flights</Link></li>
              <li><Link href="/hotels">Hotels</Link></li>
              <li><Link href="/visa">Visa Services</Link></li>
            </ul>
          </div>

          {/* Destinations */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">
              Top Destinations
            </h3>
            <ul className="space-y-2">
              <li><a href="#">Dubai Packages</a></li>
              <li><a href="#">Bali Packages</a></li>
              <li><a href="#">Singapore Packages</a></li>
              <li><a href="#">Malaysia Packages</a></li>
              <li><Link href="/about">About Us</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">
              Contact Us
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <MapPin className="w-5 h-5 mt-1" />
                <span className="text-sm">
                  123 Travel Street, Mumbai, Maharashtra 400001
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                <a href="tel:+919876543210">+91 98765 43210</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                <a href="mailto:info@yonodmc.in">info@yonodmc.in</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} YONO DMC. All rights reserved.</p>
          <div className="mt-2">
            <Link href="/privacy">Privacy Policy</Link>
            <span className="mx-2">|</span>
            <Link href="/terms">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
