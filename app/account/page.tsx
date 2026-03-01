import { redirect } from "next/navigation";
import { requirePortalRole } from "@/lib/auth/requirePortalRole";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCustomerProfileCompletionStatus } from "@/lib/backend/customerAccount";
import CustomerAccountClient from "./customer-account-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Account",
};

export default async function CustomerAccountPage() {
  const identity = await requirePortalRole("customer", {
    loginPath: "/login",
    nextPath: "/account",
  });

  const userId = identity.userId;
  if (!userId) {
    redirect("/login?next=%2Faccount");
  }

  const completed = await getCustomerProfileCompletionStatus(userId);
  if (!completed) {
    redirect("/account/onboarding");
  }

  const resolved = await getCurrentUserRole();
  const firstName = (resolved.email || "").split("@")[0] || "Traveler";

  return <CustomerAccountClient firstName={firstName} />;
}
