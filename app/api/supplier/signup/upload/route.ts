import { apiError, apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  getSupplierSignupRequestById,
  logSupplierSignupSystemEvent,
  updateSupplierSignupRequest,
} from "@/lib/supplierSignup/store";
import {
  isValidDocType,
  type SupplierDocType,
} from "@/lib/supplierSignup/validators";
import {
  uploadSupplierSignupDocument,
  validateSupplierSignupUpload,
} from "@/lib/supplierSignup/storageUpload";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(req: Request) {
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_doc_upload",
    maxRequests: 40,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many upload attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const formData = await req.formData();
    const requestId = safeString(formData.get("request_id"));
    const docTypeRaw = safeString(formData.get("doc_type"));
    const file = formData.get("file");

    if (!requestId) {
      return apiError(req, 400, "request_id_required", "request_id is required.");
    }
    if (!isValidDocType(docTypeRaw)) {
      return apiError(req, 400, "invalid_doc_type", "Invalid document type.");
    }
    if (!(file instanceof File)) {
      return apiError(req, 400, "file_required", "Document file is required.");
    }

    const uploadValidation = validateSupplierSignupUpload(file);
    if (!uploadValidation.ok) {
      return apiError(req, 400, "invalid_file", uploadValidation.message);
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, requestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }
    if (safeString(signupRequest.status) === "approved") {
      return apiError(req, 400, "request_closed", "Request is already approved.");
    }
    if (safeString(signupRequest.status) === "rejected") {
      return apiError(req, 400, "request_closed", "Request is already rejected.");
    }

    const uploaded = await uploadSupplierSignupDocument({
      db,
      requestId,
      docType: docTypeRaw as SupplierDocType,
      file,
    });

    const existingDocs = safeObject(signupRequest.docs);
    const nextDocs = {
      ...existingDocs,
      [docTypeRaw]: {
        path: uploaded.path,
        file_name: uploaded.file_name,
        file_size: uploaded.file_size,
        mime_type: uploaded.mime_type,
        bucket: uploaded.bucket,
        public_url: uploaded.public_url,
        uploaded_at: new Date().toISOString(),
      },
    };

    await updateSupplierSignupRequest(db, requestId, { docs: nextDocs });
    await logSupplierSignupSystemEvent(db, {
      requestId,
      event: "supplier_signup_doc_uploaded",
      message: "Supplier signup document uploaded.",
      meta: { doc_type: docTypeRaw, file_name: uploaded.file_name },
    });

    return apiSuccess(req, {
      request_id: requestId,
      doc_type: docTypeRaw,
      file: uploaded,
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
    return apiError(req, 500, "upload_failed", "Failed to upload document.");
  }
}
