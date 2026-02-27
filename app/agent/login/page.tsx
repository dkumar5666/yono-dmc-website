import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import AgentLoginCard from "@/components/auth/AgentLoginCard";

export const metadata = {
  title: "Agent Login",
};

export default function AgentLoginPage() {
  return (
    <AuthShell
      title="Agent Login"
      subtitle="For travel agents to manage quotations, bookings, and customer requests."
      roleBadge="B2B"
      highlightsTitle="Operational Benefits"
      highlights={["Fast quotations", "Manage traveler documents", "Priority support"]}
    >
      <Suspense fallback={<div className="h-52 animate-pulse rounded-2xl bg-slate-100" />}>
        <AgentLoginCard />
      </Suspense>
    </AuthShell>
  );
}

