import { randomUUID } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  logSupplierSignupSystemEvent,
  safeInsert,
  safeSelectMany,
  type SupplierSignupRequestRow,
} from "@/lib/supplierSignup/store";
import {
  normalizeEmail,
  normalizePhone,
  validateSupplierSignupRequestPayload,
} from "@/lib/supplierSignup/validators";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

const DEDUPE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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
  params: { contactEmail: string; contactPhone: string; sinceIso: string }
): Promise<SupplierSignupRequestRow | null> {
  const seen = new Map<string, SupplierSignupRequestRow>();

  if (params.contactEmail) {
    const rows = await safeSelectMany<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      new URLSearchParams({
        select: "*",
        contact_email: `eq.${params.contactEmail}`,
        created_at: `gte.${params.sinceIso}`,
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
        created_at: `gte.${params.sinceIso}`,
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

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_request",
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many request attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = safeObject(await req.json().catch(() => ({})));
    const honeypot = safeString(body.company);
    if (honeypot) {
      return apiError(req, 400, "spam_detected", "Invalid signup request.");
    }

    const validation = validateSupplierSignupRequestPayload(body);
    if (!validation.ok || !validation.data) {
      return apiError(
        req,
        400,
        "validation_failed",
        validation.errors[0] || "Invalid supplier signup request.",
        { errors: validation.errors }
      );
    }

    const db = new SupabaseRestClient();
    const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const existing = await findExistingRequest(db, {
      contactEmail: normalizeEmail(validation.data.contact_email),
      contactPhone: normalizePhone(validation.data.contact_phone),
      sinceIso,
    });

    if (existing) {
      const existingId = normalizeRowId(existing);
      if (existingId) {
        await logSupplierSignupSystemEvent(db, {
          requestId: existingId,
          event: "supplier_signup_request_deduped",
          message: "Supplier signup request deduped.",
          meta: {
            deduped: true,
            source_ip: rate.ip,
          },
        });
        return apiSuccess(req, {
          request_id: existingId,
          deduped: true,
          message: "Request already exists.",
        });
      }
    }

    const nowIso = new Date().toISOString();
    const rowId = randomUUID();
    const meta = {
      source_ip: rate.ip,
      user_agent: req.headers.get("user-agent") || null,
    };

    const payload: Record<string, unknown> = {
      id: rowId,
      status: "pending",
      business_type: validation.data.business_type,
      company_legal_name: validation.data.company_legal_name,
      brand_name: validation.data.brand_name || null,
      address: validation.data.address,
      city: validation.data.city,
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
      docs: {},
      email_verified: false,
      phone_verified: false,
      meta,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const inserted = await safeInsert<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      payload
    );
    if (!inserted) {
      const fallbackExisting = await findExistingRequest(db, {
        contactEmail: validation.data.contact_email,
        contactPhone: validation.data.contact_phone,
        sinceIso: "1970-01-01T00:00:00.000Z",
      });
      const fallbackId = normalizeRowId(fallbackExisting);
      if (fallbackId) {
        return apiSuccess(req, {
          request_id: fallbackId,
          deduped: true,
          message: "Request already exists.",
        });
      }
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }

    const insertedId = normalizeRowId(inserted) || rowId;
    await logSupplierSignupSystemEvent(db, {
      requestId: insertedId,
      event: "supplier_signup_request_created",
      message: "Supplier signup request created.",
      meta: {
        contact_email: validation.data.contact_email,
        contact_phone: validation.data.contact_phone,
        business_type: validation.data.business_type,
      },
    });

    safeLog(
      "supplier.signup.request.created",
      {
        requestId,
        route: "/api/supplier/signup/request",
        supplierRequestId: insertedId,
      },
      req
    );

    return apiSuccess(
      req,
      {
        request_id: insertedId,
        deduped: false,
      },
      201
    );
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }
    return apiError(
      req,
      500,
      "supplier_signup_request_failed",
      "Failed to create supplier signup request."
    );
  }
}
