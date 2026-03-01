import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { listAgentQuotes } from "@/lib/backend/agentPortal";

function safeString(value: string | null): string {
  return (value ?? "").trim();
}

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

export async function GET(req: Request) {
  const auth = requireRole(req, "agent");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const url = new URL(req.url);
    const result = await listAgentQuotes(auth.userId, {
      q: safeString(url.searchParams.get("q")),
      status: safeString(url.searchParams.get("status")),
      limit: parseLimit(url.searchParams.get("limit")),
      offset: parseOffset(url.searchParams.get("offset")),
    });
    return NextResponse.json(result);
  } catch {
    return routeError(500, "Failed to load agent quotes");
  }
}
