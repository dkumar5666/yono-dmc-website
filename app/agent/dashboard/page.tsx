import { requireRole } from "@/lib/auth/requireRole";
import AgentDashboardClient from "./agent-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AgentDashboardPage() {
  const identity = await requireRole("agent", "/agent/dashboard");
  return <AgentDashboardClient identity={{ fullName: identity.fullName || null }} />;
}
