import { randomUUID } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  getSupplierSignupRequestById,
  logSupplierSignupSystemEvent,
  safeInsert,
  safeSelectMany,
  type SupplierSignupRequestRow,
  updateSupplierSignupRequest,
} from "@/lib/supplierSignup/store";
import {
  clearSupplierSignupContextCookie,
  readSupplierSignupContextFromRequest,
} from "@/lib/supplierSignup/signupContext";
import {
  normalizeEmail,
  normalizePhone,
  validateSupplierSignupRequestPayload,
} from "@/lib/supplierSignup/validators";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeRowId(row: SupplierSignupRequestRow | null): string {
  return safeString(row?.id);
}

async function findExistingRequest(
  db: SupabaseRestClient,
  params: { contactEmail: string; contactPhone: string }
): Promise<SupplierSignupRequestRow | null> {
  const seen = new Map<string, SupplierSignupRequestRow>();

  if (params.contactEmail) {
    const rows = await safeSelectMany<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      new URLSearchParams({
        select: "*",
        contact_email: `eq.${params.contactEmail}`,
        order: "created_at.desc",
        limit: "5",
      })
    );
    for (const row of rows) {
      const id = normalizeRowId(row);
      if (id) seen.set(id, row);
    }
  }

  if (params.contactPhone) {
    const rows = await safeSelectMany<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      new URLSearchParams({
        select: "*",
        contact_phone: `eq.${params.contactPhone}`,
        order: "created_at.desc",
        limit: "5",
      })
    );
    for (const row of rows) {
      const id = normalizeRowId(row);
      if (id) seen.set(id, row);
    }
  }

  const candidates = Array.from(seen.values());
  candidates.sort((a, b) => {
    const left = new Date(safeString(a.created_at) || 0).getTime() || 0;
    const right = new Date(safeString(b.created_at) || 0).getTime() || 0;
    return right - left;
  });
  return candidates[0] ?? null;
}

async function ensureRequestRow(
  db: SupabaseRestClient,
  params: {
    requestId: string;
    contactEmail: string;
    contactPhone: string;
    ip: string;
    userAgent: string;
  }
): Promise<SupplierSignupRequestRow | null> {
  if (params.requestId) {
    return getSupplierSignupRequestById(db, params.requestId);
  }

  const existing = await findExistingRequest(db, {
    contactEmail: params.contactEmail,
    contactPhone: params.contactPhone,
  });
  if (existing) return existing;

  const nowIso = new Date().toISOString();
  const rowId = randomUUID();
  const payload: Record<string, unknown> = {
    id: rowId,
    status: "pending",
    contact_email: params.contactEmail,
    contact_phone: params.contactPhone,
    email_verified: true,
    phone_verified: true,
    docs: {},
    meta: {
      source_ip: params.ip,
      user_agent: params.userAgent,
      verification_gate: "otp_step1",
    },
    created_at: nowIso,
    updated_at: nowIso,
  };

  const inserted = await safeInsert<SupplierSignupRequestRow>(
    db,
    "supplier_signup_requests",
    payload
  );
  if (!inserted) {
    return findExistingRequest(db, {
      contactEmail: params.contactEmail,
      contactPhone: params.contactPhone,
    });
  }
  return inserted;
}

export async function POST(req: Request) {
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_details",
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many detail update attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const requestId = safeString(body.request_id);
    const contactEmail = normalizeEmail(body.contact_email);
    const contactPhone = normalizePhone(body.contact_phone);

    const context = readSupplierSignupContextFromRequest(req);
    if (!requestId) {
      if (!context || !context.emailVerified || !context.phoneVerified) {
        return apiError(
          req,
          400,
          "verification_pending",
          "Complete email and mobile OTP verification before entering business details."
        );
      }
      if (!contactEmail || !contactPhone) {
        return apiError(req, 400, "contact_required", "Verified email and mobile are required.");
      }
      if (context.email !== contactEmail || context.phone !== contactPhone) {
        return apiError(
          req,
          400,
          "verification_context_mismatch",
          "Email/mobile do not match verified values from step 1."
        );
      }
    }

    const db = new SupabaseRestClient();
    const signupRequest = await ensureRequestRow(db, {
      requestId,
      contactEmail: requestId ? "" : contactEmail,
      contactPhone: requestId ? "" : contactPhone,
      ip: rate.ip,
      userAgent: req.headers.get("user-agent") || "",
    });
    if (!signupRequest) {
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }

    const actualRequestId = normalizeRowId(signupRequest);
    if (!actualRequestId) {
      return apiError(req, 500, "request_resolution_failed", "Failed to resolve signup request.");
    }

    const status = safeString(signupRequest.status);
    if (status === "approved") {
      return apiError(req, 400, "already_approved", "Request is already approved.");
    }
    if (status === "rejected") {
      return apiError(req, 400, "already_rejected", "Request is already rejected.");
    }

    const mergedPayload: Record<string, unknown> = {
      ...body,
      contact_email: safeString(signupRequest.contact_email) || contactEmail,
      contact_phone: safeString(signupRequest.contact_phone) || contactPhone,
    };
    const validation = validateSupplierSignupRequestPayload(mergedPayload);
    if (!validation.ok || !validation.data) {
      return apiError(
        req,
        400,
        "validation_failed",
        validation.errors[0] || "Invalid supplier details.",
        { errors: validation.errors }
      );
    }

    const existingMeta = safeObject(signupRequest.meta);
    const nextMeta = {
      ...existingMeta,
      details_saved_at: new Date().toISOString(),
    };

    await updateSupplierSignupRequest(db, actualRequestId, {
      business_type: validation.data.business_type,
      company_legal_name: validation.data.company_legal_name,
      brand_name: validation.data.brand_name || null,
      address: validation.data.address,
      city: validation.data.city,
      pin_code: validation.data.pin_code,
      country: validation.data.country || "India",
      website: validation.data.website || null,
      contact_name: validation.data.contact_name,
      contact_email: validation.data.contact_email,
      contact_phone: validation.data.contact_phone,
      alt_phone: validation.data.alt_phone || null,
      support_email: validation.data.support_email || null,
      gstin: validation.data.gstin,
      pan: validation.data.pan,
      cin: validation.data.cin || null,
      iata_code: validation.data.iata_code || null,
      license_no: validation.data.license_no || null,
      bank_meta: validation.data.bank_meta || {},
      email_verified: true,
      phone_verified: true,
      meta: nextMeta,
    });

    await logSupplierSignupSystemEvent(db, {
      requestId: actualRequestId,
      event: "supplier_signup_details_saved",
      message: "Supplier signup business details saved.",
      meta: {
        business_type: validation.data.business_type,
        company_legal_name: validation.data.company_legal_name,
      },
    });

    const response = apiSuccess(req, {
      request_id: actualRequestId,
      details_saved: true,
    });
    clearSupplierSignupContextCookie(response);
    return response;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }
    return apiError(req, 500, "details_save_failed", "Failed to save supplier details.");
  }
}

