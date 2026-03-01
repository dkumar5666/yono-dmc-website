import { redirect } from "next/navigation";
import { requirePortalRole } from "@/lib/auth/requirePortalRole";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import CustomerOnboardingClient from "./customer-onboarding-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account Onboarding",
};

export default async function CustomerOnboardingPage() {
  await requirePortalRole("customer", {
    loginPath: "/login",
    nextPath: "/account/onboarding",
  });

  const identity = await getCurrentUserRole();
  if (!identity.userId) {
    redirect("/login?next=%2Faccount%2Fonboarding");
  }

  return <CustomerOnboardingClient />;
}
