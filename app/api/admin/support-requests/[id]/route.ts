import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { getAdminSupportRequestById } from "@/lib/backend/supportRequests";
import { routeError } from "@/lib/middleware/routeError";

type Params = { id: string };

export async function GET(
  req: Request,
  ctx: { params: Promise<Params> | Params }
) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const id = decodeURIComponent(resolved.id ?? "").trim();
    if (!id) return NextResponse.json({ request: null });

    const request = await getAdminSupportRequestById(id);
    return NextResponse.json({ request });
  } catch {
    return routeError(500, "Failed to load support request");
  }
}

