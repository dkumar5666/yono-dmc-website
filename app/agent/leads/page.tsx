import { requireRole } from "@/lib/auth/requireRole";
import AgentLeadsClient from "./agent-leads-client";

export const dynamic = "force-dynamic";

export default async function AgentLeadsPage() {
  await requireRole("agent", "/agent/leads");
  return <AgentLeadsClient />;
}
