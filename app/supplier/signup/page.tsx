import AuthShell from "@/components/auth/AuthShell";
import SupplierSignupClient from "@/app/supplier/signup/supplier-signup-client";

export const metadata = {
  title: "Supplier Sign Up",
};

export default function SupplierSignupPage() {
  return (
    <AuthShell
      title="Supplier Sign Up"
      subtitle="Create a supplier account request. Approval required."
      hideBrandName
      highlightsTitle="Onboarding Process"
      highlights={[
        "Submit company and compliance details",
        "Verify email and mobile with OTP",
        "Upload KYC documents for review",
      ]}
    >
      <SupplierSignupClient />
    </AuthShell>
  );
}

