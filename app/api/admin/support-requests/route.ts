import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { listAdminSupportRequests } from "@/lib/backend/supportRequests";
import { routeError } from "@/lib/middleware/routeError";

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function safeString(value: string | null): string {
  return (value ?? "").trim();
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const url = new URL(req.url);
    const status = safeString(url.searchParams.get("status"));
    const booking_id = safeString(url.searchParams.get("booking_id"));
    const q = safeString(url.searchParams.get("q"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const result = await listAdminSupportRequests({
      status,
      booking_id,
      q,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch {
    return routeError(500, "Failed to load support requests");
  }
}

