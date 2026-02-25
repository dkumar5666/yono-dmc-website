import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  Globe2,
  LayoutDashboard,
  MapPinned,
  Newspaper,
  PackagePlus,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/control-center",
    label: "Control Center",
    shortLabel: "Control",
    icon: LayoutDashboard,
  },
  { href: "/admin/catalog", label: "Catalog", shortLabel: "Catalog", icon: LayoutDashboard },
  {
    href: "/admin/destinations",
    label: "Destinations Module",
    shortLabel: "Destinations",
    icon: Globe2,
  },
  {
    href: "/admin/holiday-builder",
    label: "Holiday Builder",
    shortLabel: "Holiday Builder",
    icon: PackagePlus,
  },
  { href: "/admin/blog-posts", label: "Blog Posts", shortLabel: "Blog Posts", icon: Newspaper },
  { href: "/admin/attractions", label: "Attractions", shortLabel: "Attractions", icon: MapPinned },
  {
    href: "/admin/ai-conversations",
    label: "AI Conversations",
    shortLabel: "AI Conversations",
    icon: Bot,
  },
  {
    href: "/admin/custom-package-requests",
    label: "Custom Requests",
    shortLabel: "Custom Requests",
    icon: Building2,
  },
];

export function getAdminNavItem(pathname: string) {
  return ADMIN_NAV_ITEMS.find((item) => pathname === item.href) ?? null;
}
