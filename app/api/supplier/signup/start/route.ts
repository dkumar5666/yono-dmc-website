import { apiError, apiSuccess } from "@/lib/backend/http";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  isValidE164Phone,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
} from "@/lib/supplierSignup/validators";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface StartBody {
  contact_email?: string;
  contact_phone?: string;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_start",
    maxRequests: 12,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many signup attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as StartBody;
    const contactEmail = normalizeEmail(body.contact_email);
    const contactPhone = normalizePhone(body.contact_phone);

    if (!contactEmail) {
      return apiError(req, 400, "email_required", "Primary contact email is required.");
    }
    if (!isValidEmail(contactEmail)) {
      return apiError(req, 400, "invalid_email", "Primary contact email is invalid.");
    }
    if (!contactPhone) {
      return apiError(req, 400, "phone_required", "Primary contact mobile is required.");
    }
    if (!isValidE164Phone(contactPhone)) {
      return apiError(
        req,
        400,
        "invalid_phone",
        "Primary contact mobile must be in international format, e.g. +9199XXXXXXXX."
      );
    }

    safeLog(
      "supplier.signup.start.deferred",
      {
        requestId,
        route: "/api/supplier/signup/start",
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
    return apiError(req, 500, "supplier_signup_start_failed", "Failed to start supplier signup.");
  }
}
