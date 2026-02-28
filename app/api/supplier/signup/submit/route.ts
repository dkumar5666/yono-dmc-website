import { apiError, apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  getSupplierSignupRequestById,
  logSupplierSignupSystemEvent,
  updateSupplierSignupRequest,
} from "@/lib/supplierSignup/store";
import { hasRequiredSupplierDocs } from "@/lib/supplierSignup/validators";

interface SubmitSignupBody {
  request_id?: string;
  declaration_accepted?: boolean;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(req: Request) {
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_submit",
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many submit attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SubmitSignupBody;
    const requestId = safeString(body.request_id);
    if (!requestId) {
      return apiError(req, 400, "request_id_required", "request_id is required.");
    }
    if (body.declaration_accepted !== true) {
      return apiError(
        req,
        400,
        "declaration_required",
        "Please confirm declaration before submitting."
      );
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, requestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    const status = safeString(signupRequest.status);
    if (status === "approved") {
      return apiSuccess(req, { request_id: requestId, status: "approved" });
    }
    if (status === "rejected") {
      return apiError(req, 400, "request_rejected", "Request is already rejected.");
    }

    if (!signupRequest.email_verified) {
      return apiError(req, 400, "email_not_verified", "Email verification is required.");
    }
    if (!signupRequest.phone_verified) {
      return apiError(req, 400, "phone_not_verified", "Mobile verification is required.");
    }
    if (!hasRequiredSupplierDocs(signupRequest.docs)) {
      return apiError(
        req,
        400,
        "required_docs_missing",
        "Upload GST certificate, PAN card and business registration document."
      );
    }

    const existingMeta = safeObject(signupRequest.meta);
    const nextMeta = {
      ...existingMeta,
      declaration_accepted: true,
      verified_at: new Date().toISOString(),
    };

    await updateSupplierSignupRequest(db, requestId, {
      status: "verified",
      meta: nextMeta,
    });
    await logSupplierSignupSystemEvent(db, {
      requestId,
      event: "supplier_signup_verified",
      message: "Supplier signup request verified and submitted.",
    });

    return apiSuccess(req, {
      request_id: requestId,
      status: "verified",
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
    return apiError(req, 500, "submit_failed", "Failed to submit supplier signup request.");
  }
}
