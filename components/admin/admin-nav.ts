import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
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
  IndianRupee,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Wrench,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/business/dashboard",
    label: "Business Dashboard",
    shortLabel: "Business",
    icon: BarChart3,
  },
  {
    href: "/admin/control-center",
    label: "Control Center",
    shortLabel: "Control",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/crm/leads",
    label: "CRM (Leads)",
    shortLabel: "CRM",
    icon: ClipboardList,
  },
  {
    href: "/admin/crm/outreach",
    label: "CRM Outreach",
    shortLabel: "Outreach",
    icon: Activity,
  },
  {
    href: "/admin/copilot",
    label: "Ops Copilot",
    shortLabel: "Copilot",
    icon: Bot,
  },
  {
    href: "/admin/revenue/optimizer",
    label: "Revenue Optimizer",
    shortLabel: "Revenue",
    icon: Sparkles,
  },
  {
    href: "/admin/pricing/rules",
    label: "Pricing Rules",
    shortLabel: "Pricing",
    icon: IndianRupee,
  },
  {
    href: "/admin/pricing/versions",
    label: "Pricing Versions",
    shortLabel: "Price Ver",
    icon: IndianRupee,
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
    href: "/admin/suppliers/requests",
    label: "Supplier Requests",
    shortLabel: "Supplier Req",
    icon: Building2,
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
    href: "/admin/system/env-check",
    label: "Env Check",
    shortLabel: "Env",
    icon: ShieldCheck,
  },
  {
    href: "/admin/system/smoke-tests",
    label: "Smoke Tests",
    shortLabel: "Smoke",
    icon: ShieldCheck,
  },
  {
    href: "/admin/ops/toolkit",
    label: "Ops Toolkit",
    shortLabel: "Ops",
    icon: Wrench,
  },
  {
    href: "/admin/auth/diagnostics",
    label: "Auth Diagnostics",
    shortLabel: "Auth",
    icon: ShieldCheck,
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
