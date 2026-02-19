"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Destination, Package } from "@/data/mockData";

interface CatalogResponse {
  packages: Package[];
  destinations: Destination[];
  updatedAt?: string;
}

interface AuthUser {
  username: string;
  role: "admin" | "editor";
}

function createPackage(): Package {
  return {
    id: crypto.randomUUID(),
    slug: "",
    title: "",
    destination: "",
    duration: "4D/3N",
    price: 10000,
    image: "/api/images/hero",
    inclusions: ["Flights", "Hotels"],
    type: "family",
  };
}

function createDestination(): Destination {
  return {
    id: crypto.randomUUID(),
    name: "",
    tagline: "",
    image: "/api/images/hero",
    packages: 0,
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

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
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

export default function AdminCatalogPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        await loadCatalog();
      } catch {
        window.location.href = "/admin/login";
      }
    })();
  }, []);

  async function loadCatalog() {
    setError(null);
    try {
      const response = await fetch("/api/catalog");
      if (!response.ok) throw new Error("Failed to fetch catalog");
      const data = (await response.json()) as CatalogResponse;
      setPackages(data.packages ?? []);
      setDestinations(data.destinations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  async function saveCatalog() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packages, destinations }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Catalog saved successfully.");
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/uploads", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      throw new Error(data.error ?? "Image upload failed");
    }
    return data.url;
  }

  async function onUploadDestinationImage(index: number, file: File) {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setDestinations((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], image: url };
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadPackageImage(index: number, file: File) {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setPackages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], image: url };
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onImportDestinationsCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        const next: Destination[] = rows.map((row, index) => ({
          id: row.id || crypto.randomUUID(),
          name: row.name || `Destination ${index + 1}`,
          tagline: row.tagline || "Explore this destination",
          image: row.image || "/api/images/hero",
          packages: Number(row.packages || "0") || 0,
        }));
        setDestinations(next);
        setMessage("Destinations CSV loaded. Click Save Catalog.");
      } catch {
        setError("Invalid destination CSV format.");
      }
    };
    reader.readAsText(file);
  }

  function onImportPackagesCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        const next: Package[] = rows.map((row, index) => ({
          id: row.id || crypto.randomUUID(),
          slug: row.slug || `package-${index + 1}`,
          title: row.title || `Package ${index + 1}`,
          destination: row.destination || "Destination",
          duration: row.duration || "4D/3N",
          price: Number(row.price || "10000") || 10000,
          image: row.image || "/api/images/hero",
          inclusions: row.inclusions
            ? row.inclusions.split("|").map((item) => item.trim()).filter(Boolean)
            : ["Flights", "Hotels"],
          type:
            row.type === "family" ||
            row.type === "couple" ||
            row.type === "honeymoon" ||
            row.type === "adventure"
              ? row.type
              : "family",
        }));
        setPackages(next);
        setMessage("Packages CSV loaded. Click Save Catalog.");
      } catch {
        setError("Invalid packages CSV format.");
      }
    };
    reader.readAsText(file);
  }

  const packageCountByDestination = useMemo(() => {
    const map = new Map<string, number>();
    for (const pkg of packages) {
      map.set(pkg.destination, (map.get(pkg.destination) ?? 0) + 1);
    }
    return map;
  }, [packages]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-700">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-slate-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Catalog Admin</h1>
            <p className="text-slate-300">
              Logged in as {user.username} ({user.role})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/destinations" className="text-slate-200 hover:text-white">
              Destinations Module
            </Link>
            <Link href="/admin/holiday-builder" className="text-slate-200 hover:text-white">
              Holiday Builder
            </Link>
            <Link href="/" className="text-slate-200 hover:text-white">
              Back to site
            </Link>
            <button
              type="button"
              onClick={logout}
              className="bg-white text-slate-900 rounded-lg px-3 py-2"
            >
              Logout
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Import Destinations CSV
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onImportDestinationsCsv}
                className="mt-1 block w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Import Packages CSV
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onImportPackagesCsv}
                className="mt-1 block w-full text-sm"
              />
            </label>
            <button
              type="button"
              onClick={saveCatalog}
              disabled={busy}
              className="bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save Catalog"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            CSV headers for destinations: id,name,tagline,image,packages
            <br />
            CSV headers for packages: id,slug,title,destination,duration,price,image,inclusions,type
            <br />
            For package inclusions use pipe separator. Example: Flights|Hotels|Breakfast
          </p>
          {message ? <p className="text-green-700 text-sm mt-3">{message}</p> : null}
          {error ? <p className="text-red-700 text-sm mt-3">{error}</p> : null}
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Destinations</h2>
            <button
              type="button"
              onClick={() => setDestinations((prev) => [...prev, createDestination()])}
              className="bg-slate-900 text-white px-3 py-2 rounded-lg"
            >
              Add Destination
            </button>
          </div>

          <div className="space-y-3">
            {destinations.map((destination, index) => (
              <div key={destination.id} className="grid md:grid-cols-6 gap-3 border rounded-lg p-3">
                <input
                  value={destination.name}
                  onChange={(e) =>
                    setDestinations((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], name: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Name"
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  value={destination.tagline}
                  onChange={(e) =>
                    setDestinations((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], tagline: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Tagline"
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  value={destination.image}
                  onChange={(e) =>
                    setDestinations((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], image: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Image URL"
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  type="number"
                  value={packageCountByDestination.get(destination.name) ?? destination.packages}
                  onChange={(e) =>
                    setDestinations((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], packages: Number(e.target.value) };
                      return next;
                    })
                  }
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUploadDestinationImage(index, file);
                  }}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDestinations((prev) => prev.filter((_, item) => item !== index))
                  }
                  className="bg-red-600 text-white rounded-lg px-3 py-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Packages</h2>
            <button
              type="button"
              onClick={() => setPackages((prev) => [...prev, createPackage()])}
              className="bg-slate-900 text-white px-3 py-2 rounded-lg"
            >
              Add Package
            </button>
          </div>

          <div className="space-y-3">
            {packages.map((pkg, index) => (
              <div key={pkg.id} className="grid md:grid-cols-7 gap-3 border rounded-lg p-3">
                <input
                  value={pkg.title}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], title: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Title"
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  value={pkg.destination}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], destination: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Destination"
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  value={pkg.duration}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], duration: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Duration"
                  className="border rounded-lg px-3 py-2"
                />
                <input
                  type="number"
                  value={pkg.price}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], price: Number(e.target.value) };
                      return next;
                    })
                  }
                  placeholder="Price"
                  className="border rounded-lg px-3 py-2"
                />
                <select
                  value={pkg.type}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = {
                        ...next[index],
                        type: e.target.value as Package["type"],
                      };
                      return next;
                    })
                  }
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="family">family</option>
                  <option value="couple">couple</option>
                  <option value="honeymoon">honeymoon</option>
                  <option value="adventure">adventure</option>
                </select>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUploadPackageImage(index, file);
                  }}
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => setPackages((prev) => prev.filter((_, item) => item !== index))}
                  className="bg-red-600 text-white rounded-lg px-3 py-2"
                >
                  Remove
                </button>
                <input
                  value={pkg.slug}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], slug: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Slug"
                  className="border rounded-lg px-3 py-2 md:col-span-2"
                />
                <input
                  value={pkg.image}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], image: e.target.value };
                      return next;
                    })
                  }
                  placeholder="Image URL"
                  className="border rounded-lg px-3 py-2 md:col-span-2"
                />
                <input
                  value={pkg.inclusions.join(", ")}
                  onChange={(e) =>
                    setPackages((prev) => {
                      const next = [...prev];
                      next[index] = {
                        ...next[index],
                        inclusions: e.target.value
                          .split(",")
                          .map((part) => part.trim())
                          .filter(Boolean),
                      };
                      return next;
                    })
                  }
                  placeholder="Inclusions (comma separated)"
                  className="border rounded-lg px-3 py-2 md:col-span-3"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
