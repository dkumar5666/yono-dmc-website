import { requireRole } from "@/lib/auth/requireRole";
import AgentBookingsClient from "./agent-bookings-client";

export const dynamic = "force-dynamic";

export default async function AgentBookingsPage() {
  await requireRole("agent", "/agent/bookings");
  return <AgentBookingsClient />;
}

