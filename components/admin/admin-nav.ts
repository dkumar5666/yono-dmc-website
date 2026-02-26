import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  Newspaper,
  PackagePlus,
  RotateCcw,
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
  {
    href: "/admin/bookings",
    label: "Bookings",
    shortLabel: "Bookings",
    icon: ClipboardList,
  },
  {
    href: "/admin/payments",
    label: "Payments",
    shortLabel: "Payments",
    icon: CreditCard,
  },
  {
    href: "/admin/refunds",
    label: "Refunds",
    shortLabel: "Refunds",
    icon: RotateCcw,
  },
  {
    href: "/admin/documents",
    label: "Documents",
    shortLabel: "Documents",
    icon: FileText,
  },
  {
    href: "/admin/automation/failures",
    label: "Automation Failures",
    shortLabel: "Automation",
    icon: AlertTriangle,
  },
  {
    href: "/admin/suppliers/logs",
    label: "Supplier Logs",
    shortLabel: "Supplier Logs",
    icon: Activity,
  },
  {
    href: "/admin/support-requests",
    label: "Support Requests",
    shortLabel: "Support",
    icon: LifeBuoy,
  },
  {
    href: "/admin/system/health",
    label: "System Health",
    shortLabel: "System Health",
    icon: Activity,
  },
  {
    href: "/admin/webhooks/events",
    label: "Webhook Events",
    shortLabel: "Webhooks",
    icon: Activity,
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
