"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  Loader2,
  LogOut,
  Menu,
  Search,
  Shield,
  X,
} from "lucide-react";
import { ADMIN_NAV_ITEMS, getAdminNavItem } from "@/components/admin/admin-nav";

type AdminSessionUser = {
  username: string;
  role: "admin" | "editor";
} | null;

type AdminSearchResult = {
  type: "booking" | "payment" | "refund" | "document" | "supplier_log" | "automation_failure";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

function pageTitleForPath(pathname: string): string {
  if (pathname === "/admin") return "Admin";
  if (pathname === "/admin/login") return "Admin Sign In";

  const navItem = getAdminNavItem(pathname);
  if (navItem) return navItem.label;

  return "Admin";
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1.5">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={[
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-gradient-to-r from-[#199ce0]/15 to-[#f5991c]/10 text-slate-900 ring-1 ring-[#199ce0]/20"
                : "text-slate-600 hover:bg-white hover:text-slate-900",
            ].join(" ")}
          >
            <span
              className={[
                "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                active
                  ? "border-[#199ce0]/30 bg-white text-[#199ce0]"
                  : "border-slate-200 bg-slate-50 text-slate-500 group-hover:bg-white",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminLayoutClient({
  children,
  initialUser,
  appMode,
}: {
  children: React.ReactNode;
  initialUser: AdminSessionUser;
  appMode: "staging" | "production";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const desktopSearchRootRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRootRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    setMobileOpen(false);
    setMobileSearchOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      const insideDesktop = desktopSearchRootRef.current?.contains(target) ?? false;
      const insideMobile = mobileSearchRootRef.current?.contains(target) ?? false;
      if (insideDesktop || insideMobile) return;
      setSearchOpen(false);
      setMobileSearchOpen(false);
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      setMobileSearchOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchLoading(false);
      setSearchError(null);
      setSearchResults([]);
      return;
    }

    const seq = ++requestSeqRef.current;
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(
          `/api/admin/search?q=${encodeURIComponent(query)}&limit=8`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          results?: AdminSearchResult[];
          error?: string;
        };
        if (seq !== requestSeqRef.current) return;
        if (!response.ok) {
          throw new Error(payload.error || `Search failed (${response.status})`);
        }
        setSearchResults(Array.isArray(payload.results) ? payload.results : []);
      } catch (error) {
        if (seq !== requestSeqRef.current) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : "Search failed");
      } finally {
        if (seq === requestSeqRef.current) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const pageTitle = useMemo(() => pageTitleForPath(pathname), [pathname]);

  function navigateToSearchHref(href: string) {
    setSearchOpen(false);
    setMobileSearchOpen(false);
    router.push(href);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSearchOpen(false);
      setMobileSearchOpen(false);
      return;
    }

    if (event.key === "Enter" && searchResults.length > 0) {
      event.preventDefault();
      navigateToSearchHref(searchResults[0].href);
    }
  }

  function openMobileSearch() {
    setMobileSearchOpen(true);
    setSearchOpen(true);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }

  function typeBadgeClass(type: AdminSearchResult["type"]) {
    switch (type) {
      case "booking":
        return "border-[#199ce0]/20 bg-[#199ce0]/10 text-[#199ce0]";
      case "payment":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "refund":
        return "border-rose-200 bg-rose-50 text-rose-700";
      case "document":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "supplier_log":
        return "border-violet-200 bg-violet-50 text-violet-700";
      case "automation_failure":
        return "border-red-200 bg-red-50 text-red-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  }

  function typeLabel(type: AdminSearchResult["type"]) {
    return type.replaceAll("_", " ");
  }

  function SearchDropdownPanel() {
    const showEmpty =
      searchQuery.trim().length >= 2 && !searchLoading && !searchError && searchResults.length === 0;

    if (!searchOpen) return null;

    return (
      <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {searchLoading ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-[#199ce0]" />
            Searching...
          </div>
        ) : searchError ? (
          <div className="px-4 py-3 text-sm text-rose-700">
            <p className="font-medium">Search failed</p>
            <p className="mt-1 text-xs text-rose-600">{searchError}</p>
          </div>
        ) : showEmpty ? (
          <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
        ) : searchResults.length > 0 ? (
          <div>
            <ul className="max-h-80 overflow-y-auto p-2">
              {searchResults.map((result) => (
                <li key={`${result.type}:${result.id}`}>
                  <button
                    type="button"
                    onClick={() => navigateToSearchHref(result.href)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${typeBadgeClass(
                        result.type
                      )}`}
                    >
                      {typeLabel(result.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{result.title}</span>
                      {result.subtitle ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <Link
                href="/admin/bookings"
                onClick={() => {
                  setSearchOpen(false);
                  setMobileSearchOpen(false);
                }}
                className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              >
                Go to Bookings
              </Link>
              <Link
                href="/admin/payments"
                onClick={() => {
                  setSearchOpen(false);
                  setMobileSearchOpen(false);
                }}
                className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              >
                Go to Payments
              </Link>
            </div>
          </div>
        ) : searchQuery.trim().length < 2 ? (
          <div className="px-4 py-3 text-sm text-slate-500">Type at least 2 characters to search</div>
        ) : null}
      </div>
    );
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore and force redirect
    } finally {
      window.location.href = "/admin/login";
    }
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-50/80 backdrop-blur lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-5 py-4">
            <Link href="/admin/catalog" className="flex items-center gap-3 rounded-xl p-2 hover:bg-white">
              <Image src="/logo.png" alt="Yono DMC" width={120} height={40} className="h-10 w-auto" />
              <div>
                <p className="text-sm font-semibold leading-tight text-slate-900">Yono DMC</p>
                <p className="text-xs text-slate-500">Admin Panel</p>
              </div>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Workspace
            </p>
            <NavList pathname={pathname} />
          </div>

          <div className="border-t border-slate-200 p-4">
            <Link
              href="/"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Back to site
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMobileOpen(false)} />
        ) : null}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-slate-50 p-4 shadow-2xl transition-transform lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="mb-4 flex items-center justify-between">
            <Link href="/admin/catalog" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
              <Image src="/logo.png" alt="Yono DMC" width={96} height={32} className="h-8 w-auto" />
              <div>
                <p className="text-sm font-semibold">Yono DMC</p>
                <p className="text-xs text-slate-500">Admin</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          <div className="mt-4 border-t border-slate-200 pt-4">
            <Link
              href="/"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700"
              onClick={() => setMobileOpen(false)}
            >
              Back to site
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="relative sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  <Shield className="h-3.5 w-3.5" />
                  Admin Workspace
                  {appMode === "staging" ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-amber-700">
                      STAGING
                    </span>
                  ) : null}
                </div>
                <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{pageTitle}</h1>
              </div>

              <div ref={desktopSearchRootRef} className="relative hidden w-full max-w-md lg:block">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={desktopSearchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Search booking, payment, refund..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#199ce0]"
                  />
                  {searchLoading ? (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#199ce0]" />
                  ) : null}
                </div>
                <SearchDropdownPanel />
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div ref={mobileSearchRootRef} className="relative lg:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      if (mobileSearchOpen) {
                        setMobileSearchOpen(false);
                        setSearchOpen(false);
                      } else {
                        openMobileSearch();
                      }
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
                    aria-label="Open admin search"
                  >
                    <Search className="h-4 w-4" />
                  </button>

                  {mobileSearchOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,24rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => setSearchOpen(true)}
                          onKeyDown={onSearchKeyDown}
                          placeholder="Search booking, payment, refund..."
                          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none focus:border-[#199ce0]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setMobileSearchOpen(false);
                            setSearchOpen(false);
                          }}
                          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                          aria-label="Close search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="relative mt-2">
                        <SearchDropdownPanel />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right sm:block">
                  <p className="text-sm font-semibold text-slate-900">
                    {initialUser?.username ?? "Admin"}
                  </p>
                  <p className="text-xs capitalize text-slate-500">{initialUser?.role ?? "session"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{loggingOut ? "Logging out..." : "Logout"}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
