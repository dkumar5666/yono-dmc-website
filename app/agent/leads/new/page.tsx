import { requireRole } from "@/lib/auth/requireRole";
import AgentNewLeadClient from "./new-lead-client";

export const dynamic = "force-dynamic";

export default async function AgentNewLeadPage() {
  await requireRole("agent", "/agent/leads/new");
  return <AgentNewLeadClient />;
}
