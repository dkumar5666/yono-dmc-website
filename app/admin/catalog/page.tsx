"use client";

import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Database,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  Package as PackageIcon,
  Plus,
  RefreshCw,
  Save,
  Search,
  Upload,
} from "lucide-react";
import { Destination, Package } from "@/data/mockData";

interface CatalogResponse {
  packages: Package[];
  destinations: Destination[];
  updatedAt?: string;
  error?: string;
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

function formatDateTime(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isHeroLikeImage(value?: string | null): boolean {
  const image = String(value ?? "").trim();
  return !image || image === "/api/images/hero";
}

function TableSkeleton({ rows = 4, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, colIndex) => (
            <div key={colIndex} className="h-10 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminCatalogPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [busy, setBusy] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState("");
  const [packageSearch, setPackageSearch] = useState("");
  const [packageDestinationFilter, setPackageDestinationFilter] = useState("all");
  const [expandedPackageRows, setExpandedPackageRows] = useState<Record<string, boolean>>({});
  const importPanelRef = useRef<HTMLDivElement | null>(null);

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
    setCatalogLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/catalog");
      const data = (await response.json().catch(() => ({}))) as CatalogResponse;
      if (!response.ok) {
        const details = data.error ? `: ${data.error}` : "";
        throw new Error(`Failed to fetch catalog (${response.status})${details}`);
      }
      setPackages(data.packages ?? []);
      setDestinations(data.destinations ?? []);
      setUpdatedAt(data.updatedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch catalog");
    } finally {
      setCatalogLoading(false);
    }
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
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        updatedAt?: string;
      };
      if (!response.ok) {
        throw new Error(`Save failed (${response.status})${data.error ? `: ${data.error}` : ""}`);
      }
      setMessage("Catalog saved successfully.");
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
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
    setMessage(null);
    try {
      const url = await uploadImage(file);
      setDestinations((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], image: url };
        return next;
      });
      setMessage("Destination image uploaded. Save catalog to persist changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadPackageImage(index: number, file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const url = await uploadImage(file);
      setPackages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], image: url };
        return next;
      });
      setMessage("Package image uploaded. Save catalog to persist changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onImportDestinationsCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
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
        setMessage(`Loaded ${next.length} destinations from CSV. Click Save Catalog to publish.`);
      } catch {
        setError("Invalid destination CSV format. Please verify headers and values.");
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => {
      setError("Unable to read destination CSV file.");
      setBusy(false);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function onImportPackagesCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
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
        setMessage(`Loaded ${next.length} packages from CSV. Click Save Catalog to publish.`);
      } catch {
        setError("Invalid packages CSV format. Please verify headers and values.");
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => {
      setError("Unable to read packages CSV file.");
      setBusy(false);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const packageCountByDestination = useMemo(() => {
    const map = new Map<string, number>();
    for (const pkg of packages) {
      const key = pkg.destination.trim() || "Unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [packages]);

  const destinationOptions = useMemo(
    () => Array.from(new Set(packages.map((pkg) => pkg.destination).filter(Boolean))).sort(),
    [packages]
  );

  const filteredDestinations = useMemo(() => {
    const query = destinationSearch.trim().toLowerCase();
    if (!query) return destinations;
    return destinations.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.tagline.toLowerCase().includes(query) ||
        (item.image ?? "").toLowerCase().includes(query)
      );
    });
  }, [destinations, destinationSearch]);

  const filteredPackages = useMemo(() => {
    const query = packageSearch.trim().toLowerCase();
    return packages.filter((pkg) => {
      const matchesDestination =
        packageDestinationFilter === "all" || pkg.destination === packageDestinationFilter;
      if (!matchesDestination) return false;
      if (!query) return true;
      return (
        pkg.title.toLowerCase().includes(query) ||
        pkg.destination.toLowerCase().includes(query) ||
        pkg.slug.toLowerCase().includes(query) ||
        pkg.inclusions.join(", ").toLowerCase().includes(query)
      );
    });
  }, [packages, packageSearch, packageDestinationFilter]);

  const missingImageCount = useMemo(() => {
    const destinationMissing = destinations.filter((item) => isHeroLikeImage(item.image)).length;
    const packageMissing = packages.filter((item) => isHeroLikeImage(item.image)).length;
    return destinationMissing + packageMissing;
  }, [destinations, packages]);

  const quickStats = useMemo(
    () => [
      { label: "Destinations", value: destinations.length, helper: "Editable rows", icon: Database },
      { label: "Packages", value: packages.length, helper: "Catalog entries", icon: PackageIcon },
      { label: "Image warnings", value: missingImageCount, helper: "Default hero image in use", icon: ImageIcon },
    ],
    [destinations.length, packages.length, missingImageCount]
  );

  function openImportPanel() {
    setShowImportPanel(true);
    requestAnimationFrame(() => {
      importPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking authentication…
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <TableSkeleton rows={5} columns={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-red-100 p-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-900">Catalog action failed</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadCatalog()}
                  disabled={catalogLoading || busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${catalogLoading ? "animate-spin" : ""}`} />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Quick Actions
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Catalog operations</h2>
              <p className="mt-1 text-sm text-slate-600">
                Import CSVs, review records and save the catalog without leaving this page.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadCatalog()}
              disabled={catalogLoading || busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${catalogLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <button
              type="button"
              onClick={openImportPanel}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[#199ce0]/30 hover:bg-[#199ce0]/5"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#199ce0]">
                  <Upload className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Import Destinations CSV</p>
                  <p className="text-xs text-slate-500">Open upload panel</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={openImportPanel}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-[#f5991c]/30 hover:bg-[#f5991c]/5"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#f5991c]">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Import Packages CSV</p>
                  <p className="text-xs text-slate-500">Pipe separator supported</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={saveCatalog}
              disabled={busy || catalogLoading}
              className="rounded-2xl bg-gradient-to-r from-[#199ce0] to-[#0f7fca] p-4 text-left text-white shadow-lg shadow-[#199ce0]/20 transition hover:from-[#158dcf] hover:to-[#0b73bd] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-semibold">{busy ? "Saving catalog..." : "Save Catalog"}</p>
                  <p className="text-xs text-white/80">Persist all destination and package changes</p>
                </div>
              </div>
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            CSV uploads load into the editor first. Click <span className="font-semibold">Save Catalog</span> to make changes live.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Catalog Status
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">
                Last updated
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(updatedAt)}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {quickStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                        {stat.label}
                      </p>
                      <Icon className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.helper}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        ref={importPanelRef}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Import Panel
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Bulk CSV import</h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload destination and package CSV files into the catalog editor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowImportPanel((prev) => !prev)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {showImportPanel ? "Hide panel" : "Show panel"}
          </button>
        </div>

        {showImportPanel ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-[#199ce0]" />
                <h3 className="font-semibold text-slate-900">Destinations CSV upload</h3>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onImportDestinationsCsv}
                disabled={busy}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white disabled:opacity-60"
              />
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Expected headers
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                id,name,tagline,image,packages
              </pre>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-[#f5991c]" />
                <h3 className="font-semibold text-slate-900">Packages CSV upload</h3>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={onImportPackagesCsv}
                disabled={busy}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white disabled:opacity-60"
              />
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                Expected headers
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                id,slug,title,destination,duration,price,image,inclusions,type
              </pre>
              <p className="mt-2 text-xs text-slate-500">
                Use pipe separator. Example: <code>Flights|Hotels|Breakfast</code>
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="max-w-7xl mx-auto space-y-8">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Destinations Table
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Manage destinations</h2>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="relative sm:min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={destinationSearch}
                  onChange={(e) => setDestinationSearch(e.target.value)}
                  placeholder="Search destinations"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => setDestinations((prev) => [...prev, createDestination()])}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-3 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                Add Destination
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            {catalogLoading ? (
              <div className="p-4">
                <TableSkeleton rows={5} columns={6} />
              </div>
            ) : (
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Tagline</th>
                    <th className="px-3 py-3">Image</th>
                    <th className="px-3 py-3">Packages count</th>
                    <th className="px-3 py-3">Updated</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDestinations.map((destination) => {
                    const index = destinations.findIndex((item) => item.id === destination.id);
                    const computedPackageCount =
                      packageCountByDestination.get(destination.name) ?? destination.packages;

                    return (
                      <tr key={destination.id} className="border-t border-slate-200 align-top hover:bg-slate-50/60">
                        <td className="px-3 py-3">
                          <input
                            value={destination.name}
                            onChange={(e) =>
                              setDestinations((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], name: e.target.value };
                                return next;
                              })
                            }
                            placeholder="Destination name"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                          />
                        </td>
                        <td className="px-3 py-3">
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
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-10 w-14 rounded-lg border border-slate-200 bg-slate-100 bg-cover bg-center"
                                style={{ backgroundImage: destination.image ? `url(${destination.image})` : undefined }}
                              />
                              <span className="max-w-[180px] truncate text-xs text-slate-500">
                                {destination.image || "No image"}
                              </span>
                            </div>
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
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                            />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void onUploadDestinationImage(index, file);
                              }}
                              className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-900 file:px-2 file:py-1 file:text-white"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            min={0}
                            value={computedPackageCount}
                            onChange={(e) =>
                              setDestinations((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], packages: Number(e.target.value) || 0 };
                                return next;
                              })
                            }
                            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2"
                          />
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {updatedAt ? formatDateTime(updatedAt) : "N/A"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled
                              title="Rows are inline editable"
                              className="cursor-not-allowed rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-400"
                            >
                              Inline Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDestinations((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                              }
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDestinations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                        No destinations match your search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Packages Table
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Manage holiday packages</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_200px_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={packageSearch}
                  onChange={(e) => setPackageSearch(e.target.value)}
                  placeholder="Search title, destination, inclusions"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
                />
              </label>
              <select
                value={packageDestinationFilter}
                onChange={(e) => setPackageDestinationFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">All destinations</option>
                {destinationOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setPackages((prev) => [...prev, createPackage()])}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-3 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                Add Package
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            {catalogLoading ? (
              <div className="p-4">
                <TableSkeleton rows={5} columns={7} />
              </div>
            ) : (
              <table className="w-full min-w-[1280px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Title</th>
                    <th className="px-3 py-3">Destination</th>
                    <th className="px-3 py-3">Duration</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Inclusions</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackages.map((pkg) => {
                    const index = packages.findIndex((item) => item.id === pkg.id);
                    const advancedOpen = Boolean(expandedPackageRows[pkg.id]);
                    return (
                      <Fragment key={pkg.id}>
                        <tr
                          className="border-t border-slate-200 align-top hover:bg-slate-50/60"
                        >
                          <td className="px-3 py-3">
                            <input
                              value={pkg.title}
                              onChange={(e) =>
                                setPackages((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], title: e.target.value };
                                  return next;
                                })
                              }
                              placeholder="Package title"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                            />
                          </td>
                          <td className="px-3 py-3">
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
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              value={pkg.duration}
                              onChange={(e) =>
                                setPackages((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], duration: e.target.value };
                                  return next;
                                })
                              }
                              placeholder="5D/4N"
                              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              value={pkg.price}
                              onChange={(e) =>
                                setPackages((prev) => {
                                  const next = [...prev];
                                  next[index] = { ...next[index], price: Number(e.target.value) || 0 };
                                  return next;
                                })
                              }
                              className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            />
                          </td>
                          <td className="px-3 py-3">
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
                              placeholder="Flights, Hotels"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                            />
                          </td>
                          <td className="px-3 py-3">
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
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <option value="family">family</option>
                              <option value="couple">couple</option>
                              <option value="honeymoon">honeymoon</option>
                              <option value="adventure">adventure</option>
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedPackageRows((prev) => ({
                                    ...prev,
                                    [pkg.id]: !prev[pkg.id],
                                  }))
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                              >
                                {advancedOpen ? "Hide" : "More"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPackages((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                                }
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {advancedOpen ? (
                          <tr className="border-t border-slate-100 bg-slate-50/60">
                            <td colSpan={7} className="px-3 py-3">
                              <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
                                <label className="block">
                                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                                    Slug
                                  </span>
                                  <input
                                    value={pkg.slug}
                                    onChange={(e) =>
                                      setPackages((prev) => {
                                        const next = [...prev];
                                        next[index] = { ...next[index], slug: e.target.value };
                                        return next;
                                      })
                                    }
                                    placeholder="package-slug"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                                    Image URL
                                  </span>
                                  <input
                                    value={pkg.image}
                                    onChange={(e) =>
                                      setPackages((prev) => {
                                        const next = [...prev];
                                        next[index] = { ...next[index], image: e.target.value };
                                        return next;
                                      })
                                    }
                                    placeholder="/api/images/hero"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                  />
                                </label>
                                <div className="flex flex-col justify-end gap-2">
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <div
                                      className="h-9 w-12 rounded-md border border-slate-200 bg-white bg-cover bg-center"
                                      style={{ backgroundImage: pkg.image ? `url(${pkg.image})` : undefined }}
                                    />
                                    Preview
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) void onUploadPackageImage(index, file);
                                    }}
                                    className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-slate-900 file:px-2 file:py-1 file:text-white"
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {filteredPackages.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                        No packages match your filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}


