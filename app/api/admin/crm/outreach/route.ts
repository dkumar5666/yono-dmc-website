import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { getOutreachDashboardData } from "@/lib/crm/outreachScheduler";

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const data = await getOutreachDashboardData();
    return NextResponse.json(data);
  } catch {
    return routeError(500, "Failed to load CRM outreach dashboard");
  }
}

