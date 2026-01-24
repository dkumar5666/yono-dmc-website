"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export default function Hero() {
  const [tab, setTab] = useState("holidays");

  return (
    <section className="relative bg-blue-900 py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Tabs */}
          <div className="flex gap-6 border-b mb-6">
            {["holidays", "flights", "hotels", "visa"].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-2 font-medium ${
                  tab === t
                    ? "border-b-2 border-teal-500 text-teal-600"
                    : "text-gray-500"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input className="border rounded-lg px-4 py-3" placeholder="From City" />
            <input className="border rounded-lg px-4 py-3" placeholder="Destination" />
            <input type="date" className="border rounded-lg px-4 py-3" />
            <button className="bg-orange-500 text-white rounded-lg flex items-center justify-center gap-2">
              <Search className="w-5 h-5" />
              Get Best Price
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
