import { requireRole } from "@/lib/auth/requireRole";
import AgentLeadDetailClient from "./agent-lead-detail-client";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function AgentLeadDetailPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  await requireRole("agent", "/agent/leads");
  const resolved = "then" in params ? await params : params;
  const leadId = decodeURIComponent(resolved.id ?? "");
  return <AgentLeadDetailClient leadId={leadId} />;
}

