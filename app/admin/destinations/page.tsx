"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface DestinationRecord {
  id: string;
  destination_name: string;
  tagline: string;
  continent: string;
  cities: string[];
  image_url: string;
  package_count: number;
  updated_at: string;
}

const defaultCities = [
  "Dubai",
  "Abu Dhabi",
  "Singapore City",
  "Sentosa",
  "Kuala Lumpur",
  "Genting Highlands",
  "Penang",
  "Langkawi",
  "Bali",
  "Ubud",
  "Kuta",
  "Nusa Dua",
];

interface DestinationFormState {
  destination_name: string;
  tagline: string;
  continent: string;
  cities: string[];
  image_url: string;
  package_count: number;
}

const emptyForm: DestinationFormState = {
  destination_name: "",
  tagline: "",
  continent: "Asia",
  cities: [],
  image_url: "",
  package_count: 0,
};

function toImageKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminDestinationsPage() {
  const [list, setList] = useState<DestinationRecord[]>([]);
  const [continents, setContinents] = useState<string[]>(["Asia"]);
  const [form, setForm] = useState<DestinationFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customCity, setCustomCity] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cityOptions = useMemo(
    () => Array.from(new Set([...defaultCities, ...list.flatMap((item) => item.cities)])),
    [list]
  );

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        window.location.href = "/admin/login";
        return;
      }
      await loadDestinations();
    })();
  }, []);

  async function loadDestinations() {
    setError(null);
    const response = await fetch("/api/admin/destinations");
    const data = (await response.json()) as {
      data?: DestinationRecord[];
      meta?: { continents?: string[] };
      error?: string;
    };
    if (!response.ok) {
      setError(data.error ?? "Failed to load destinations");
      return;
    }
    setList(data.data ?? []);
    if (Array.isArray(data.meta?.continents) && data.meta.continents.length > 0) {
      setContinents(data.meta.continents);
    }
  }

  function startEdit(item: DestinationRecord) {
    setEditingId(item.id);
    setForm({
      destination_name: item.destination_name,
      tagline: item.tagline,
      continent: item.continent,
      cities: item.cities,
      image_url: item.image_url,
      package_count: item.package_count,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setCustomCity("");
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        ...form,
        cities: form.cities.filter(Boolean),
      };
      const endpoint = editingId
        ? `/api/admin/destinations/${editingId}`
        : "/api/admin/destinations";
      const method = editingId ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save destination");
      }
      setMessage(editingId ? "Destination updated." : "Destination created.");
      resetForm();
      await loadDestinations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save destination");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this destination?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/destinations/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Delete failed");
      setMessage("Destination deleted.");
      await loadDestinations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleCity(city: string) {
    setForm((prev) => ({
      ...prev,
      cities: prev.cities.includes(city)
        ? prev.cities.filter((item) => item !== city)
        : [...prev.cities, city],
    }));
  }

  function addCustomCity() {
    const city = customCity.trim();
    if (!city) return;
    if (!form.cities.includes(city)) {
      setForm((prev) => ({ ...prev, cities: [...prev.cities, city] }));
    }
    setCustomCity("");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Destination Management</h1>
            <p className="text-slate-300">Create and manage destination master data</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/catalog" className="text-slate-200 hover:text-white">
              Catalog Admin
            </Link>
            <Link href="/admin/holiday-builder" className="text-slate-200 hover:text-white">
              Holiday Builder
            </Link>
            <Link href="/admin/attractions" className="text-slate-200 hover:text-white">
              Attractions
            </Link>
            <Link href="/admin/blog-posts" className="text-slate-200 hover:text-white">
              Blog Posts
            </Link>
            <Link href="/admin/ai-conversations" className="text-slate-200 hover:text-white">
              AI Conversations
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <form onSubmit={submitForm} className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit Destination" : "Add Destination"}
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Destination Name *</span>
              <input
                required
                value={form.destination_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, destination_name: e.target.value }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Tagline *</span>
              <input
                required
                maxLength={255}
                value={form.tagline}
                onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Continent *</span>
              <select
                required
                value={form.continent}
                onChange={(e) => setForm((prev) => ({ ...prev, continent: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                {continents.map((continent) => (
                  <option key={continent} value={continent}>
                    {continent}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Image URL (optional)</span>
              <input
                value={form.image_url}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="/api/images/malaysia"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    image_url: `/api/images/${toImageKey(prev.destination_name || "hero")}`,
                  }))
                }
                className="mt-2 text-xs border rounded px-2 py-1"
              >
                Use Image API Path
              </button>
            </label>
          </div>

          <div>
            <span className="text-sm font-medium">Cities (optional)</span>
            <div className="mt-2 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {cityOptions.map((city) => (
                <label key={city} className="flex items-center gap-2 text-sm border rounded p-2">
                  <input
                    type="checkbox"
                    checked={form.cities.includes(city)}
                    onChange={() => toggleCity(city)}
                  />
                  {city}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Add custom city"
                className="border rounded-lg px-3 py-2 flex-1"
              />
              <button
                type="button"
                onClick={addCustomCity}
                className="bg-slate-800 text-white rounded-lg px-4 py-2"
              >
                Add City
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <label className="block">
              <span className="text-sm font-medium">Package Count</span>
              <input
                type="number"
                min={0}
                value={form.package_count}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, package_count: Number(e.target.value) || 0 }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {busy ? "Saving..." : editingId ? "Update Destination" : "Create Destination"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="border rounded-lg px-4 py-2"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
          {message ? <p className="text-green-700 text-sm">{message}</p> : null}
          {error ? <p className="text-red-700 text-sm">{error}</p> : null}
        </form>

        <div className="bg-white rounded-xl shadow p-6 overflow-x-auto">
          <h2 className="text-xl font-semibold mb-4">Destination List</h2>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Tagline</th>
                <th className="py-2 pr-3">Continent</th>
                <th className="py-2 pr-3">Cities</th>
                <th className="py-2 pr-3">Packages</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-3 font-medium">{item.destination_name}</td>
                  <td className="py-3 pr-3">{item.tagline}</td>
                  <td className="py-3 pr-3">{item.continent}</td>
                  <td className="py-3 pr-3">{item.cities.join(", ") || "-"}</td>
                  <td className="py-3 pr-3">{item.package_count}</td>
                  <td className="py-3 pr-3">{item.updated_at}</td>
                  <td className="py-3 space-x-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="border rounded px-3 py-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(item.id)}
                      className="bg-red-600 text-white rounded px-3 py-1"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
