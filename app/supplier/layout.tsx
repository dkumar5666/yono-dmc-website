import { headers } from "next/headers";
import SupplierLayoutShell from "@/components/supplier/SupplierLayoutShell";
import { requirePortalRole } from "@/lib/auth/requirePortalRole";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-yono-pathname")?.trim() || "";

  await requirePortalRole("supplier", {
    currentPath: pathname,
    loginPath: "/supplier/login",
    allowUnauthenticatedPaths: ["/supplier/login", "/supplier/signup"],
    nextPath: pathname || "/supplier/dashboard",
  });

  return <SupplierLayoutShell>{children}</SupplierLayoutShell>;
}
