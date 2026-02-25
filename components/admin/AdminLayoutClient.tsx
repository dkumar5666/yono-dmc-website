"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  LogOut,
  Menu,
  Shield,
  X,
} from "lucide-react";
import { ADMIN_NAV_ITEMS, getAdminNavItem } from "@/components/admin/admin-nav";

type AdminSessionUser = {
  username: string;
  role: "admin" | "editor";
} | null;

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
}: {
  children: React.ReactNode;
  initialUser: AdminSessionUser;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const pageTitle = useMemo(() => pageTitleForPath(pathname), [pathname]);

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
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
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
                </div>
                <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{pageTitle}</h1>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
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
