import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { getAgentBookingDetail } from "@/lib/backend/agentPortal";

type Params = { booking_id: string };

export async function GET(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "agent");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const bookingRef = decodeURIComponent(resolved.booking_id ?? "").trim();
    if (!bookingRef) {
      return NextResponse.json({
        booking: null,
        lead: null,
        quotations: [],
        payments: [],
        documents: [],
      });
    }

    const detail = await getAgentBookingDetail(auth.userId, bookingRef);
    if (!detail.booking) {
      return NextResponse.json({
        booking: null,
        lead: null,
        quotations: [],
        payments: [],
        documents: [],
      });
    }

    return NextResponse.json(detail);
  } catch {
    return routeError(500, "Failed to load agent booking");
  }
}
