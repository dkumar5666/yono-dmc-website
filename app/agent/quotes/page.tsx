import { requireRole } from "@/lib/auth/requireRole";
import AgentQuotesClient from "./agent-quotes-client";

export const dynamic = "force-dynamic";

export default async function AgentQuotesPage() {
  await requireRole("agent", "/agent/quotes");
  return <AgentQuotesClient />;
}

