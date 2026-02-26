import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";

type Params = { booking_id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in params ? await params : params;
    const bookingId = decodeURIComponent(resolved.booking_id ?? "").trim();
    if (!bookingId) return routeError(404, "Booking not found");

    try {
      const db = new SupabaseRestClient();
      await writeAdminAuditLog(db, {
        adminId: auth.userId,
        action: "resync_supplier",
        entityType: "booking",
        entityId: bookingId,
        message: "Supplier resync requested (scaffold action)",
        meta: {
          actor_role: auth.role ?? "admin",
          actor_user_id: auth.userId ?? null,
          actor_username: safeString(auth.claims.username),
        },
      });
    } catch (error) {
      if (!(error instanceof SupabaseNotConfiguredError)) {
        // Swallow audit errors per safe-fallback requirement.
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Supplier resync request recorded. Resync execution is not enabled in this phase.",
    });
  } catch {
    return routeError(500, "Failed to record supplier resync action");
  }
}

