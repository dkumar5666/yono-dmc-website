"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TicketedAttraction } from "@/data/ticketedAttractions";

interface AuthUser {
  username: string;
  role: "admin" | "editor";
}

interface AttractionsApiResponse {
  attractions?: TicketedAttraction[];
  updatedAt?: string;
  error?: string;
}

interface EditableAttraction {
  id: string;
  countryName: string;
  title: string;
  location: string;
  category: string;
  image: string;
  rating: number;
  reviews: number;
  tagline: string;
  cities: string;
  duration: string;
  timing: string;
  highlights: string;
  inclusions: string;
  exclusions: string;
  cancellationPolicy: string;
  meetingPoint: string;
  mapQuery: string;
}

function toEditable(item: TicketedAttraction): EditableAttraction {
  return {
    id: item.id,
    countryName: item.countryName,
    title: item.title,
    location: item.location,
    category: item.category,
    image: item.image,
    rating: item.rating,
    reviews: item.reviews,
    tagline: item.tagline,
    cities: item.cities.join(", "),
    duration: item.duration,
    timing: item.timing,
    highlights: item.highlights.join(" | "),
    inclusions: item.inclusions.join(" | "),
    exclusions: item.exclusions.join(" | "),
    cancellationPolicy: item.cancellationPolicy,
    meetingPoint: item.meetingPoint,
    mapQuery: item.mapQuery,
  };
}

function splitList(value: string): string[] {
  return value
    .split(/\||,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPayload(item: EditableAttraction) {
  return {
    id: item.id,
    countryName: item.countryName,
    title: item.title,
    location: item.location,
    category: item.category,
    image: item.image,
    rating: Number(item.rating),
    reviews: Number(item.reviews),
    tagline: item.tagline,
    cities: splitList(item.cities),
    duration: item.duration,
    timing: item.timing,
    highlights: splitList(item.highlights),
    inclusions: splitList(item.inclusions),
    exclusions: splitList(item.exclusions),
    cancellationPolicy: item.cancellationPolicy,
    meetingPoint: item.meetingPoint,
    mapQuery: item.mapQuery,
  };
}

function parseCsvLine(line: string): string[] {
  const output: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      output.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  output.push(current.trim());
  return output;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/[\s_]+/g, "")
  );

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    rows.push(record);
  }

  return rows;
}

function rowValue(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key.toLowerCase().replace(/[\s_]+/g, "")];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function csvRowsToEditable(rows: Array<Record<string, string>>): EditableAttraction[] {
  return rows
    .map((row, index) => {
      const title = rowValue(row, "title", "name");
      const countryName = rowValue(row, "country", "countryname", "destination");
      if (!title || !countryName) return null;

      return {
        id: rowValue(row, "id") || `csv-${index + 1}`,
        countryName,
        title,
        location: rowValue(row, "location") || countryName,
        category: rowValue(row, "category") || "Observation & Landmark",
        image: rowValue(row, "image", "imageurl") || "",
        rating: Number(rowValue(row, "rating")) || 4.5,
        reviews: Number(rowValue(row, "reviews")) || 100,
        tagline: rowValue(row, "tagline") || `${countryName} top experiences`,
        cities: rowValue(row, "cities") || countryName,
        duration: rowValue(row, "duration") || "1-3 Hours",
        timing: rowValue(row, "timing") || "Daily opening hours vary by attraction",
        highlights: rowValue(row, "highlights"),
        inclusions: rowValue(row, "inclusions"),
        exclusions: rowValue(row, "exclusions"),
        cancellationPolicy:
          rowValue(row, "cancellationpolicy", "cancellation_policy") ||
          "Free cancellation up to 24-48 hours before activity start time, subject to supplier terms.",
        meetingPoint:
          rowValue(row, "meetingpoint", "meeting_point") ||
          `${countryName} central pickup point or direct venue entry`,
        mapQuery: rowValue(row, "mapquery", "map_query") || `${title}, ${countryName}`,
      };
    })
    .filter((item): item is EditableAttraction => Boolean(item));
}

function createEmptyAttraction(): EditableAttraction {
  return {
    id: `new-${crypto.randomUUID()}`,
    countryName: "",
    title: "",
    location: "",
    category: "Observation & Landmark",
    image: "",
    rating: 4.5,
    reviews: 100,
    tagline: "",
    cities: "",
    duration: "1-3 Hours",
    timing: "Daily opening hours vary by attraction",
    highlights: "",
    inclusions: "",
    exclusions: "",
    cancellationPolicy: "",
    meetingPoint: "",
    mapQuery: "",
  };
}

export default function AdminAttractionsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attractions, setAttractions] = useState<EditableAttraction[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("-");

  useEffect(() => {
    void (async () => {
      try {
        const meResponse = await fetch("/api/auth/me");
        if (!meResponse.ok) {
          window.location.href = "/admin/login";
          return;
        }
        const meData = (await meResponse.json()) as { user: AuthUser };
        setUser(meData.user);
        await loadAttractions();
      } catch {
        window.location.href = "/admin/login";
      }
    })();
  }, []);

  async function loadAttractions() {
    setError(null);
    const response = await fetch("/api/admin/attractions");
    const data = (await response.json()) as AttractionsApiResponse;
    if (!response.ok) {
      setError(data.error ?? "Failed to load attractions");
      return;
    }
    setAttractions((data.attractions ?? []).map(toEditable));
    setUpdatedAt(data.updatedAt ?? "-");
  }

  async function saveAttractions() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = attractions
        .filter((item) => item.title.trim() && item.countryName.trim())
        .map(toPayload);

      const response = await fetch("/api/admin/attractions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attractions: payload }),
      });
      const data = (await response.json()) as AttractionsApiResponse;
      if (!response.ok) throw new Error(data.error ?? "Failed to save attractions");

      setMessage("Attractions updated successfully.");
      setAttractions((data.attractions ?? []).map(toEditable));
      setUpdatedAt(data.updatedAt ?? "-");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save attractions");
    } finally {
      setBusy(false);
    }
  }

  function onImportCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        const imported = csvRowsToEditable(rows);
        if (imported.length === 0) {
          setError("CSV has no valid rows. Required: country + title.");
          return;
        }
        setAttractions(imported);
        setMessage(`Loaded ${imported.length} attractions from CSV. Click Save.`);
        setError(null);
      } catch {
        setError("Invalid CSV file. Please verify headers and format.");
      }
    };
    reader.readAsText(file);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return attractions;
    return attractions.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.countryName.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
    );
  }, [attractions, query]);

  const countryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of attractions) {
      const key = item.countryName || "Unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [attractions]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-700">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-slate-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Attractions Admin</h1>
            <p className="text-slate-300">
              Upload and manage ticketed attractions via CSV
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/catalog" className="text-slate-200 hover:text-white">
              Catalog Admin
            </Link>
            <Link href="/admin/destinations" className="text-slate-200 hover:text-white">
              Destinations
            </Link>
            <Link href="/admin/holiday-builder" className="text-slate-200 hover:text-white">
              Holiday Builder
            </Link>
            <Link href="/" className="text-slate-200 hover:text-white">
              Back to site
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Import Attractions CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onImportCsv}
                className="mt-1 block w-full text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Filter Rows</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by country, title, or location"
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setAttractions((prev) => [createEmptyAttraction(), ...prev])}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium"
              >
                Add Row
              </button>
              <button
                type="button"
                onClick={saveAttractions}
                disabled={busy}
                className="h-10 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save Attractions"}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            CSV minimum headers: <code>country,title</code>
            <br />
            Supported optional headers: <code>location,category,image,rating,reviews,tagline,cities,duration,timing,highlights,inclusions,exclusions,cancellationPolicy,meetingPoint,mapQuery</code>
          </p>
          <p className="text-xs text-gray-500">
            Last saved: {updatedAt}
          </p>
          {message ? <p className="text-green-700 text-sm">{message}</p> : null}
          {error ? <p className="text-red-700 text-sm">{error}</p> : null}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">Country Counts</h2>
          <div className="flex flex-wrap gap-2">
            {countryCounts.map(([country, count]) => (
              <span
                key={country}
                className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {country}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold">
            Attractions List ({filtered.length})
          </h2>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {filtered.map((item, index) => (
              <article key={`${item.id}-${index}`} className="border rounded-xl p-4 space-y-3">
                <div className="grid md:grid-cols-6 gap-3">
                  <input
                    value={item.countryName}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], countryName: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Country"
                    className="border rounded-lg px-3 py-2"
                  />
                  <input
                    value={item.title}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], title: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Attraction title"
                    className="border rounded-lg px-3 py-2 md:col-span-2"
                  />
                  <input
                    value={item.location}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], location: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Location"
                    className="border rounded-lg px-3 py-2"
                  />
                  <input
                    value={item.category}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], category: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Category"
                    className="border rounded-lg px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => setAttractions((prev) => prev.filter((_, i) => i !== attractions.indexOf(item)))}
                    className="rounded-lg bg-red-600 px-3 py-2 text-white"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                  <input
                    value={item.image}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], image: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Image URL"
                    className="border rounded-lg px-3 py-2 md:col-span-2"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={5}
                    value={item.rating}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], rating: Number(e.target.value) || 0 };
                        return next;
                      })
                    }
                    className="border rounded-lg px-3 py-2"
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.reviews}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], reviews: Number(e.target.value) || 0 };
                        return next;
                      })
                    }
                    className="border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <input
                    value={item.cities}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], cities: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Cities (comma or | separated)"
                    className="border rounded-lg px-3 py-2"
                  />
                  <input
                    value={item.tagline}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], tagline: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Tagline"
                    className="border rounded-lg px-3 py-2"
                  />
                  <input
                    value={item.duration}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], duration: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Duration"
                    className="border rounded-lg px-3 py-2"
                  />
                  <input
                    value={item.timing}
                    onChange={(e) =>
                      setAttractions((prev) => {
                        const next = [...prev];
                        const idx = attractions.indexOf(item);
                        if (idx >= 0) next[idx] = { ...next[idx], timing: e.target.value };
                        return next;
                      })
                    }
                    placeholder="Timing"
                    className="border rounded-lg px-3 py-2"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
