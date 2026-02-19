"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PackageStatus = "draft" | "published" | "archived";

interface ItineraryDay {
  day_number: number;
  title: string;
  description: string;
}

interface AddonItem {
  addon_key: string;
  addon_label: string;
  enabled: boolean;
  price: number;
}

interface HotelItem {
  hotel_name: string;
  hotel_category: string;
  room_category: string;
  city?: string;
  notes?: string;
}

interface PassengerDetails {
  number_of_passengers: number;
  number_of_rooms: number;
  room_category: string;
  hotel_category: string;
  hotel_name: string;
}

interface HolidayPackagePayload {
  id?: string;
  package_name: string;
  package_description: string;
  travel_date?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  itinerary_description?: string;
  status: PackageStatus;
  flight_link?: string | null;
  airline_name?: string | null;
  departure_city?: string | null;
  arrival_city?: string | null;
  itinerary: ItineraryDay[];
  addons: AddonItem[];
  hotels: HotelItem[];
  passenger_details: PassengerDetails;
}

interface PackageSummary {
  id: string;
  package_name: string;
  status: PackageStatus;
  travel_date: string | null;
  travel_start_date: string | null;
  travel_end_date: string | null;
  updated_at: string;
}

const addonTemplate: AddonItem[] = [
  { addon_key: "visa_assistance", addon_label: "Visa Assistance", enabled: false, price: 0 },
  { addon_key: "travel_insurance", addon_label: "Travel Insurance", enabled: false, price: 0 },
  { addon_key: "airport_transfers", addon_label: "Airport Transfers", enabled: false, price: 0 },
  { addon_key: "tours_activities", addon_label: "Tours & Activities", enabled: false, price: 0 },
  { addon_key: "meal_plans", addon_label: "Meal Plans", enabled: false, price: 0 },
  {
    addon_key: "early_late_checkin",
    addon_label: "Early Check-in / Late Check-out",
    enabled: false,
    price: 0,
  },
];

function createEmptyPackage(): HolidayPackagePayload {
  return {
    package_name: "",
    package_description: "",
    travel_date: null,
    travel_start_date: null,
    travel_end_date: null,
    itinerary_description: "",
    status: "draft",
    flight_link: "",
    airline_name: "",
    departure_city: "",
    arrival_city: "",
    itinerary: [
      {
        day_number: 1,
        title: "Arrival",
        description: "<p>Arrive and transfer to hotel.</p>",
      },
    ],
    addons: addonTemplate,
    hotels: [
      {
        hotel_name: "",
        hotel_category: "4 Star",
        room_category: "Deluxe",
        city: "",
        notes: "",
      },
    ],
    passenger_details: {
      number_of_passengers: 2,
      number_of_rooms: 1,
      room_category: "Deluxe",
      hotel_category: "4 Star",
      hotel_name: "",
    },
  };
}

export default function HolidayBuilderPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payload, setPayload] = useState<HolidayPackagePayload>(createEmptyPackage());
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        window.location.href = "/admin/login";
        return;
      }
      await loadPackages();
    })();
  }, []);

  const totalAddonPrice = useMemo(
    () =>
      payload.addons
        .filter((addon) => addon.enabled)
        .reduce((sum, addon) => sum + (Number(addon.price) || 0), 0),
    [payload.addons]
  );

  async function loadPackages() {
    const response = await fetch("/api/admin/holiday-packages");
    const data = (await response.json()) as { data?: PackageSummary[]; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to load package list");
      return;
    }
    setPackages(data.data ?? []);
  }

  function resetBuilder() {
    setEditingId(null);
    setPayload(createEmptyPackage());
    setActiveStep(1);
  }

  async function openPackage(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/holiday-packages/${id}`);
      const data = (await response.json()) as { data?: HolidayPackagePayload; error?: string };
      if (!response.ok || !data.data) throw new Error(data.error ?? "Failed to load package");
      setEditingId(id);
      setPayload(data.data);
      setActiveStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load package");
    } finally {
      setBusy(false);
    }
  }

  async function savePackage(targetStatus?: PackageStatus) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body = JSON.stringify({
        ...payload,
        status: targetStatus ?? payload.status,
      });
      const response = await fetch(
        editingId ? `/api/admin/holiday-packages/${editingId}` : "/api/admin/holiday-packages",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }
      );
      const data = (await response.json()) as {
        data?: { id?: string };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Failed to save package");

      if (!editingId && data.data?.id) {
        setEditingId(data.data.id);
      }
      setMessage("Package saved successfully.");
      await loadPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save package");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this package?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/holiday-packages/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Delete failed");
      if (editingId === id) resetBuilder();
      setMessage("Package deleted.");
      await loadPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDuplicate(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/holiday-packages/${id}/duplicate`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Duplicate failed");
      setMessage("Package duplicated.");
      await loadPackages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setBusy(false);
    }
  }

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setPayload((prev) => {
      const next = [...prev.itinerary];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return {
        ...prev,
        itinerary: next.map((item, idx) => ({ ...item, day_number: idx + 1 })),
      };
    });
    setDragIndex(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void savePackage();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Holiday Customize Builder</h1>
            <p className="text-slate-300">Detailed package builder with publish workflow</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/catalog" className="text-slate-200 hover:text-white">Catalog Admin</Link>
            <Link href="/admin/destinations" className="text-slate-200 hover:text-white">Destinations</Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={onSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStep(step)}
                  className={`px-3 py-1.5 rounded-full text-sm ${activeStep === step ? "bg-blue-700 text-white" : "bg-gray-200"}`}
                >
                  Step {step}
                </button>
              ))}
            </div>

            {activeStep === 1 ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Step 1: Package Info</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium">Package Name *</span>
                    <input required value={payload.package_name} onChange={(e) => setPayload((prev) => ({ ...prev, package_name: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium">Package Description *</span>
                    <textarea required rows={3} value={payload.package_description} onChange={(e) => setPayload((prev) => ({ ...prev, package_description: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Travel Date</span>
                    <input type="date" value={payload.travel_date ?? ""} onChange={(e) => setPayload((prev) => ({ ...prev, travel_date: e.target.value || null }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-sm font-medium">Start Date</span>
                      <input type="date" value={payload.travel_start_date ?? ""} onChange={(e) => setPayload((prev) => ({ ...prev, travel_start_date: e.target.value || null }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">End Date</span>
                      <input type="date" value={payload.travel_end_date ?? ""} onChange={(e) => setPayload((prev) => ({ ...prev, travel_end_date: e.target.value || null }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                    </label>
                  </div>

                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium">Itinerary Description (Rich Text)</span>
                    <div className="mt-1 border rounded-lg px-3 py-2 min-h-[100px]" contentEditable suppressContentEditableWarning onBlur={(e) => setPayload((prev) => ({ ...prev, itinerary_description: e.currentTarget.innerHTML }))} dangerouslySetInnerHTML={{ __html: payload.itinerary_description ?? "" }} />
                  </label>
                </div>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Step 2: Hotel & Room</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">Passengers *</span>
                    <input type="number" min={1} value={payload.passenger_details.number_of_passengers} onChange={(e) => setPayload((prev) => ({ ...prev, passenger_details: { ...prev.passenger_details, number_of_passengers: Number(e.target.value) || 1 } }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Rooms *</span>
                    <input type="number" min={1} value={payload.passenger_details.number_of_rooms} onChange={(e) => setPayload((prev) => ({ ...prev, passenger_details: { ...prev.passenger_details, number_of_rooms: Number(e.target.value) || 1 } }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Room Category *</span>
                    <input required value={payload.passenger_details.room_category} onChange={(e) => setPayload((prev) => ({ ...prev, passenger_details: { ...prev.passenger_details, room_category: e.target.value } }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium">Hotel Category *</span>
                    <input required value={payload.passenger_details.hotel_category} onChange={(e) => setPayload((prev) => ({ ...prev, passenger_details: { ...prev.passenger_details, hotel_category: e.target.value } }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium">Hotel Name *</span>
                    <input required value={payload.passenger_details.hotel_name} onChange={(e) => setPayload((prev) => ({ ...prev, passenger_details: { ...prev.passenger_details, hotel_name: e.target.value } }))} className="mt-1 w-full border rounded-lg px-3 py-2" />
                  </label>
                </div>

                <h3 className="font-semibold">Additional Hotels</h3>
                {payload.hotels.map((hotel, index) => (
                  <div key={`hotel-${index}`} className="grid md:grid-cols-5 gap-3 border rounded-lg p-3">
                    <input placeholder="Hotel Name" value={hotel.hotel_name} onChange={(e) => setPayload((prev) => { const next = [...prev.hotels]; next[index] = { ...next[index], hotel_name: e.target.value }; return { ...prev, hotels: next }; })} className="border rounded-lg px-3 py-2" />
                    <input placeholder="Hotel Category" value={hotel.hotel_category} onChange={(e) => setPayload((prev) => { const next = [...prev.hotels]; next[index] = { ...next[index], hotel_category: e.target.value }; return { ...prev, hotels: next }; })} className="border rounded-lg px-3 py-2" />
                    <input placeholder="Room Category" value={hotel.room_category} onChange={(e) => setPayload((prev) => { const next = [...prev.hotels]; next[index] = { ...next[index], room_category: e.target.value }; return { ...prev, hotels: next }; })} className="border rounded-lg px-3 py-2" />
                    <input placeholder="City" value={hotel.city ?? ""} onChange={(e) => setPayload((prev) => { const next = [...prev.hotels]; next[index] = { ...next[index], city: e.target.value }; return { ...prev, hotels: next }; })} className="border rounded-lg px-3 py-2" />
                    <button type="button" onClick={() => setPayload((prev) => ({ ...prev, hotels: prev.hotels.filter((_, item) => item !== index) }))} className="bg-red-600 text-white rounded-lg px-3 py-2">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => setPayload((prev) => ({ ...prev, hotels: [...prev.hotels, { hotel_name: "", hotel_category: "4 Star", room_category: "Deluxe", city: "", notes: "" }] }))} className="bg-slate-800 text-white rounded-lg px-4 py-2">Add Hotel</button>
              </div>
            ) : null}

            {activeStep === 3 ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Step 3: Itinerary Builder</h2>
                <p className="text-sm text-gray-600">Drag and reorder days. Each day supports rich text description.</p>
                <div className="space-y-3">
                  {payload.itinerary.map((day, index) => (
                    <article key={`day-${index}`} draggable onDragStart={() => onDragStart(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(index)} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="font-semibold">Day {day.day_number}</p>
                        <button type="button" onClick={() => setPayload((prev) => ({ ...prev, itinerary: prev.itinerary.filter((_, item) => item !== index).map((item, idx) => ({ ...item, day_number: idx + 1 })) }))} className="text-red-700 text-sm">Remove Day</button>
                      </div>
                      <input placeholder="Day title" value={day.title} onChange={(e) => setPayload((prev) => { const next = [...prev.itinerary]; next[index] = { ...next[index], title: e.target.value }; return { ...prev, itinerary: next }; })} className="w-full border rounded-lg px-3 py-2 mb-2" />
                      <div className="border rounded-lg px-3 py-2 min-h-[110px]" contentEditable suppressContentEditableWarning onBlur={(e) => setPayload((prev) => { const next = [...prev.itinerary]; next[index] = { ...next[index], description: e.currentTarget.innerHTML }; return { ...prev, itinerary: next }; })} dangerouslySetInnerHTML={{ __html: day.description }} />
                    </article>
                  ))}
                </div>
                <button type="button" onClick={() => setPayload((prev) => ({ ...prev, itinerary: [...prev.itinerary, { day_number: prev.itinerary.length + 1, title: `Day ${prev.itinerary.length + 1}`, description: "<p>Day activities</p>" }] }))} className="bg-slate-800 text-white rounded-lg px-4 py-2">Add Day</button>
              </div>
            ) : null}

            {activeStep === 4 ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Step 4: Add-ons</h2>
                <div className="space-y-3">
                  {payload.addons.map((addon, index) => (
                    <div key={addon.addon_key} className="grid md:grid-cols-4 gap-3 border rounded-lg p-3">
                      <label className="flex items-center gap-2 md:col-span-2">
                        <input type="checkbox" checked={addon.enabled} onChange={(e) => setPayload((prev) => { const next = [...prev.addons]; next[index] = { ...next[index], enabled: e.target.checked }; return { ...prev, addons: next }; })} />
                        <span>{addon.addon_label}</span>
                      </label>
                      <input value={addon.addon_label} onChange={(e) => setPayload((prev) => { const next = [...prev.addons]; next[index] = { ...next[index], addon_label: e.target.value }; return { ...prev, addons: next }; })} className="border rounded-lg px-3 py-2" />
                      <input type="number" min={0} value={addon.price} onChange={(e) => setPayload((prev) => { const next = [...prev.addons]; next[index] = { ...next[index], price: Number(e.target.value) || 0 }; return { ...prev, addons: next }; })} className="border rounded-lg px-3 py-2" />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-700 font-medium">Total selected add-on amount: INR {totalAddonPrice.toLocaleString("en-IN")}</p>
              </div>
            ) : null}

            {activeStep === 5 ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Step 5: Review & Publish</h2>
                <div className="border rounded-lg p-4 text-sm space-y-2">
                  <p><span className="font-semibold">Package:</span> {payload.package_name}</p>
                  <p><span className="font-semibold">Travel:</span> {payload.travel_date || `${payload.travel_start_date ?? "-"} to ${payload.travel_end_date ?? "-"}`}</p>
                  <p><span className="font-semibold">Passengers / Rooms:</span> {payload.passenger_details.number_of_passengers} / {payload.passenger_details.number_of_rooms}</p>
                  <p><span className="font-semibold">Itinerary Days:</span> {payload.itinerary.length}</p>
                  <p><span className="font-semibold">Enabled Add-ons:</span> {payload.addons.filter((addon) => addon.enabled).length}</p>
                  <label className="block pt-2">
                    <span className="text-sm font-medium">Status</span>
                    <select value={payload.status} onChange={(e) => setPayload((prev) => ({ ...prev, status: e.target.value as PackageStatus }))} className="mt-1 border rounded-lg px-3 py-2">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-3">
              <button type="submit" disabled={busy} className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">{busy ? "Saving..." : editingId ? "Update Package" : "Create Package"}</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => void savePackage("draft")} className="border rounded-lg px-4 py-2">Save as Draft</button>
                <button type="button" onClick={() => void savePackage("published")} className="bg-green-700 text-white rounded-lg px-4 py-2">Publish</button>
              </div>
            </div>
            {message ? <p className="text-green-700 text-sm">{message}</p> : null}
            {error ? <p className="text-red-700 text-sm">{error}</p> : null}
          </form>
        </div>

        <aside className="bg-white rounded-xl shadow p-4 h-fit">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Existing Packages</h2>
            <button type="button" onClick={resetBuilder} className="text-sm underline">New</button>
          </div>
          <div className="space-y-3">
            {packages.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 text-sm">
                <p className="font-semibold">{item.package_name}</p>
                <p className="text-gray-600 capitalize">{item.status}</p>
                <p className="text-gray-500 text-xs">{item.updated_at}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void openPackage(item.id)} className="border rounded px-2 py-1">Edit</button>
                  <button type="button" onClick={() => void onDuplicate(item.id)} className="border rounded px-2 py-1">Duplicate</button>
                  <button type="button" onClick={() => void onDelete(item.id)} className="bg-red-600 text-white rounded px-2 py-1">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
