import { headers } from "next/headers";
import AgentLayoutShell from "@/components/agent/AgentLayoutShell";
import { requirePortalRole } from "@/lib/auth/requirePortalRole";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-yono-pathname")?.trim() || "";

  await requirePortalRole("agent", {
    currentPath: pathname,
    loginPath: "/agent/login",
    allowUnauthenticatedPaths: ["/agent/login", "/agent/signup"],
    nextPath: pathname || "/agent/dashboard",
  });

  return <AgentLayoutShell>{children}</AgentLayoutShell>;
}
