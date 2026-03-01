import { apiError, apiSuccess } from "@/lib/backend/http";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  isValidE164Phone,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
} from "@/lib/supplierSignup/validators";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
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
    const honeypot = typeof body.company === "string" ? body.company.trim() : "";
    if (honeypot) {
      return apiError(req, 400, "spam_detected", "Invalid signup request.");
    }

    const contactEmail = normalizeEmail(body.contact_email);
    const contactPhone = normalizePhone(body.contact_phone);
    if (!contactEmail || !isValidEmail(contactEmail)) {
      return apiError(req, 400, "invalid_email", "Primary contact email is invalid.");
    }
    if (!contactPhone || !isValidE164Phone(contactPhone)) {
      return apiError(
        req,
        400,
        "invalid_phone",
        "Primary contact mobile must be in international format, e.g. +9199XXXXXXXX."
      );
    }

    safeLog(
      "supplier.signup.request.deferred",
      {
        requestId,
        route: "/api/supplier/signup/request",
        sourceIp: rate.ip,
      },
      req
    );

    return apiSuccess(req, {
      step: "verification_required",
      message:
        "Request ID is generated only after email and mobile OTP verification. Use the OTP send/verify endpoints first.",
    });
  } catch {
    return apiError(
      req,
      500,
      "supplier_signup_request_failed",
      "Failed to create supplier signup request."
    );
  }
}
