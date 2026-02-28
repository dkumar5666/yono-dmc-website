import { apiError, apiSuccess } from "@/lib/backend/http";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  getSupplierSignupRequestById,
  logSupplierSignupSystemEvent,
  updateSupplierSignupRequest,
} from "@/lib/supplierSignup/store";

type Params = { id: string };

interface RejectBody {
  reason?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const requestId = decodeURIComponent(resolved.id ?? "").trim();
    if (!requestId) {
      return apiError(req, 400, "invalid_request_id", "Invalid request id.");
    }

    const body = (await req.json().catch(() => ({}))) as RejectBody;
    const reason = safeString(body.reason);
    if (!reason) {
      return apiError(req, 400, "reason_required", "Rejection reason is required.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, requestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    const existingMeta = safeObject(signupRequest.meta);
    const nextMeta = {
      ...existingMeta,
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
      rejected_by: auth.userId,
    };

    await updateSupplierSignupRequest(db, requestId, {
      status: "rejected",
      meta: nextMeta,
    });
    await logSupplierSignupSystemEvent(db, {
      requestId,
      event: "supplier_signup_rejected",
      message: "Supplier signup request rejected.",
      meta: {
        reason,
      },
    });
    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action: "reject_supplier_request",
      entityType: "supplier_signup_request",
      entityId: requestId,
      message: "Rejected supplier signup request.",
      meta: { reason },
    });

    return apiSuccess(req, {
      request_id: requestId,
      status: "rejected",
      reason,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }
    return apiError(req, 500, "reject_failed", "Failed to reject supplier request.");
  }
}
