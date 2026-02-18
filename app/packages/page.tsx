"use client";

import { useState } from "react";
import { packages } from "@/data/mockData";
import PackageCard from "@/components/PackageCard";
import { Filter } from "lucide-react";

export default function PackagesPage() {
  const [selectedDestination, setSelectedDestination] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [sortBy, setSortBy] = useState("popular");

  const filteredPackages = packages.filter((pkg) => {
    if (
      selectedDestination !== "all" &&
      pkg.destination !== selectedDestination
    )
      return false;

    if (selectedType !== "all" && pkg.type !== selectedType) return false;

    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ================= HEADER ================= */}
      <section className="bg-blue-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Holiday Packages
          </h1>
          <p className="text-xl text-gray-300">
            Find your perfect international getaway
          </p>
        </div>
      </section>

      {/* ================= FILTERS ================= */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Filter Packages</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Destination */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Destination
              </label>
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Destinations</option>
                <option value="Dubai">Dubai</option>
                <option value="Bali">Bali</option>
                <option value="Singapore">Singapore</option>
                <option value="Malaysia">Malaysia</option>
              </select>
            </div>

            {/* Travel Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Travel Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Types</option>
                <option value="family">Family</option>
                <option value="couple">Couple</option>
                <option value="honeymoon">Honeymoon</option>
                <option value="adventure">Adventure</option>
              </select>
            </div>

            {/* Budget (UI only for now) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget
              </label>
              <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                <option>All Budgets</option>
                <option>Under &#8377;40,000</option>
                <option>&#8377;40,000 - &#8377;60,000</option>
                <option>Above &#8377;60,000</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="popular">Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* ================= RESULTS ================= */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing{" "}
            <span className="font-semibold">
              {filteredPackages.length}
            </span>{" "}
            packages
          </p>
        </div>

        {/* ================= PACKAGE GRID ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => (
            <PackageCard key={pkg.id} package={pkg} />
          ))}
        </div>
      </section>
    </div>
  );
}


