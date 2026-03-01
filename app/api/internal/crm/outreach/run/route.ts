import { NextResponse } from "next/server";
import { routeError } from "@/lib/middleware/routeError";
import { runOutreachScheduler } from "@/lib/crm/outreachScheduler";
import { assertInternalRequest } from "@/lib/auth/assertServerAuth";

async function handle(req: Request) {
  const internalDenied = assertInternalRequest(req);
  if (internalDenied) return internalDenied;

  try {
    const summary = await runOutreachScheduler();
    return NextResponse.json(summary);
  } catch {
    return routeError(500, "Failed to run CRM outreach scheduler");
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
