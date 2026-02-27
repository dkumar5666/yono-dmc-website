import AuthShell from "@/components/auth/AuthShell";
import OfficialLoginCard from "@/components/auth/OfficialLoginCard";

export const metadata = {
  title: "Official Login",
};

export default function OfficialLoginPage() {
  return (
    <AuthShell
      title="Official Login"
      subtitle="For Yono DMC staff access to admin and operations tools."
      roleBadge="Office"
      highlightsTitle="Access Scope"
      highlights={["Control Center", "Operations workflows", "Security-audited access"]}
    >
      <OfficialLoginCard />
    </AuthShell>
  );
}

