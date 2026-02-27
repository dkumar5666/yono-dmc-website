import AuthShell from "@/components/auth/AuthShell";
import SupplierLoginCard from "@/components/auth/SupplierLoginCard";

export const metadata = {
  title: "Supplier Login",
};

export default function SupplierLoginPage() {
  return (
    <AuthShell
      title="Supplier Login"
      subtitle="For partners to manage allocations, confirmations, and service fulfillment."
      roleBadge="Vendor"
      highlightsTitle="Partner Operations"
      highlights={["Allocation visibility", "Faster confirmations", "Service fulfillment tracking"]}
    >
      <SupplierLoginCard />
    </AuthShell>
  );
}

