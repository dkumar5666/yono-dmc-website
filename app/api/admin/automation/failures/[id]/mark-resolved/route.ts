import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";

type Params = { id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function markResolvedInTable(
  db: SupabaseRestClient,
  table: string,
  failureId: string
): Promise<boolean> {
  try {
    const updated = await db.updateSingle<Record<string, unknown>>(
      table,
      new URLSearchParams({
        id: `eq.${failureId}`,
      }),
      {
        status: "resolved",
        updated_at: new Date().toISOString(),
      }
    );
    return Boolean(updated);
  } catch {
    return false;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in params ? await params : params;
    const failureId = decodeURIComponent(resolved.id ?? "").trim();
    if (!failureId) return routeError(404, "Automation failure not found");

    const db = new SupabaseRestClient();
    const marked =
      (await markResolvedInTable(db, "automation_failures", failureId)) ||
      (await markResolvedInTable(db, "event_failures", failureId));

    if (!marked) {
      return routeError(404, "Automation failure not found");
    }

    try {
      await writeAdminAuditLog(db, {
        adminId: auth.userId,
        action: "mark_failure_resolved",
        entityType: "automation_failure",
        entityId: failureId,
        message: "Automation failure marked as resolved",
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
      message: "Failure marked as resolved.",
    });
  } catch {
    return routeError(500, "Failed to mark automation failure as resolved");
  }
}
