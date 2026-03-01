import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import OfficialLoginCard from "@/components/auth/OfficialLoginCard";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

export const metadata = {
  title: "Official Login",
};

export default async function OfficialLoginPage() {
  const identity = await getCurrentUserRole();
  if (identity.role === "admin" || identity.role === "staff") {
    redirect("/admin/control-center");
  }

  return (
    <AuthShell
      title="Official Login"
      subtitle="For Yono DMC office staff access to admin and operations tools."
      hideBrandName
      highlightsTitle="Access Scope"
      highlights={["Control Center", "Operations workflows", "Security-audited access"]}
    >
      <OfficialLoginCard />
    </AuthShell>
  );
}
