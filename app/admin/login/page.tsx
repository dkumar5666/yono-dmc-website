import AuthShell from "@/components/auth/AuthShell";
import OfficialLoginCard from "@/components/auth/OfficialLoginCard";
import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export const metadata = {
  title: "Admin Login",
};

export default async function AdminLoginPage() {
  const identity = await getCurrentUserRole();
  if (identity.role === "admin") {
    redirect("/admin/control-center");
  }

  return (
    <AuthShell
      title="Admin Login"
      subtitle="For Yono DMC staff access to admin and operations tools."
      hideBrandName
      highlightsTitle="Access Scope"
      highlights={["Control Center", "Operations workflows", "Security-audited access"]}
    >
      <OfficialLoginCard />
    </AuthShell>
  );
}
