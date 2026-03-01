import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { generateDocsForBooking } from "@/lib/documents/generateBookingDocs";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";

type Params = { booking_id: string };

function adminUsername(auth: ReturnType<typeof requireRole>): string | null {
  const username = auth.claims?.username;
  if (typeof username === "string" && username.trim()) return username.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
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

    const summary = await generateDocsForBooking(bookingId, "admin.generate_documents");

    try {
      const db = new SupabaseRestClient();
      await writeAdminAuditLog(db, {
        adminId: auth.userId,
        action: "generate_documents",
        entityType: "booking",
        entityId: bookingId,
        message: "Manual document generation triggered",
        meta: {
          actor_role: auth.role ?? "admin",
          actor_user_id: auth.userId ?? null,
          actor_username: adminUsername(auth),
          generated_count: summary.generated.length,
          skipped_count: summary.skipped.length,
          failed_count: summary.failed.length,
        },
      });
    } catch (error) {
      if (!(error instanceof SupabaseNotConfiguredError)) {
        // Safe fallback: audit failures must not break document generation response.
      }
    }

    return NextResponse.json({
      ok: summary.ok,
      generated: summary.generated,
      skipped: summary.skipped,
      failed: summary.failed,
      message: summary.ok
        ? "Documents generation completed."
        : "Documents generation completed with failures.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate documents";
    return NextResponse.json(
      {
        success: false,
        error: message || "Failed to generate documents",
      },
      { status: 500 }
    );
  }
}
