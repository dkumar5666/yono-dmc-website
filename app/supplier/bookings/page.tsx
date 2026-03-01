import { requireRole } from "@/lib/auth/requireRole";
import SupplierBookingsClient from "./supplier-bookings-client";

export const dynamic = "force-dynamic";

export default async function SupplierBookingsPage() {
  await requireRole("supplier", "/supplier/bookings");
  return <SupplierBookingsClient />;
}

