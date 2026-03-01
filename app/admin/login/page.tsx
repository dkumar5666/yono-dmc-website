import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export const metadata = {
  title: "Admin Login",
};

export default async function AdminLoginPage() {
  const identity = await getCurrentUserRole();
  if (identity.role === "admin" || identity.role === "staff") {
    redirect("/admin/control-center");
  }
  redirect("/official-login");
}
