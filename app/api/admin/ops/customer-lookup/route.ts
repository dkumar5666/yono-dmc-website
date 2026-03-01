import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { getRequestId } from "@/lib/system/requestContext";
import { createOpsDb, runCustomerLookup } from "@/lib/ops/opsActions";
import { respondOpsAction } from "../_shared";

function toLimit(value: string | null): number {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, Math.floor(parsed)));
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const url = new URL(req.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    if (!query) return routeError(400, "q is required");

    const db = createOpsDb();
    if (!db) return routeError(500, "Supabase is not configured");

    const result = await runCustomerLookup(
      db,
      query,
      {
        userId: auth.userId,
        role: auth.role,
        username: typeof auth.claims.username === "string" ? auth.claims.username : null,
      },
      toLimit(url.searchParams.get("limit"))
    );
    return respondOpsAction(result, requestId);
  } catch {
    return routeError(500, "Failed to lookup customer");
  }
}
