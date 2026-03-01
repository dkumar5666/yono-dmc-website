"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, ReceiptText } from "lucide-react";

const SUPPLIER_NAV = [
  { href: "/supplier/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/supplier/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/supplier/invoices", label: "Invoices", icon: ReceiptText },
];

export default function SupplierLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/supplier/login" || pathname === "/supplier/signup") return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-5 py-4">
            <Link href="/supplier/dashboard" className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
              <Image src="/logo.png" alt="Yono DMC" width={120} height={40} className="h-10 w-auto" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Yono DMC</p>
                <p className="text-xs text-slate-500">Supplier Portal</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1.5 px-4 py-4">
            {SUPPLIER_NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-[#199ce0]/10 text-slate-900 ring-1 ring-[#199ce0]/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                      active
                        ? "border-[#199ce0]/30 bg-white text-[#199ce0]"
                        : "border-slate-200 bg-slate-50 text-slate-500",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-slate-200 p-4">
            <Link
              href="/"
              className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700 hover:border-slate-300"
            >
              Back to site
            </Link>
            <form action="/api/auth/supabase/logout" method="post">
              <button
                type="submit"
                className="w-full rounded-xl bg-[#199ce0] px-3 py-2 text-sm font-semibold text-white hover:bg-[#148bc7]"
              >
                Logout
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
