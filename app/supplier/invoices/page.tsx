import { requireRole } from "@/lib/auth/requireRole";
import SupplierInvoicesClient from "./supplier-invoices-client";

export const dynamic = "force-dynamic";

export default async function SupplierInvoicesPage() {
  await requireRole("supplier", "/supplier/invoices");
  return <SupplierInvoicesClient />;
}

