import { requireRole } from "@/lib/auth/requireRole";
import AgentBookingDetailClient from "./agent-booking-detail-client";

export const dynamic = "force-dynamic";

type Params = { booking_id: string };

export default async function AgentBookingDetailPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  await requireRole("agent", "/agent/bookings");
  const resolved = "then" in params ? await params : params;
  const bookingId = decodeURIComponent(resolved.booking_id ?? "");
  return <AgentBookingDetailClient bookingId={bookingId} />;
}

