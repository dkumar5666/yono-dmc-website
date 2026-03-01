import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  sendPhoneOtp,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import {
  isTwilioVerifyConfigured,
  sendOtpWithTwilio,
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
} from "@/lib/auth/twilioVerifyFallback";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  getSupplierSignupRequestById,
  logSupplierSignupSystemEvent,
  updateSupplierSignupRequest,
} from "@/lib/supplierSignup/store";
import {
  readSupplierSignupContextFromRequest,
  setSupplierSignupContextCookie,
} from "@/lib/supplierSignup/signupContext";
import { normalizeEmail, normalizePhone } from "@/lib/supplierSignup/validators";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface SendPhoneOtpBody {
  request_id?: string;
  email?: string;
  phone?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_phone_otp_send",
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many OTP requests. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SendPhoneOtpBody;
    const signupRequestId = safeString(body.request_id);
    const emailInput = normalizeEmail(body.email);
    const phoneInput = normalizePhone(body.phone);
    if (!signupRequestId) {
      if (!emailInput) return apiError(req, 400, "email_required", "Primary contact email is required.");
      if (!phoneInput) return apiError(req, 400, "phone_required", "Primary contact mobile is required.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = signupRequestId
      ? await getSupplierSignupRequestById(db, signupRequestId)
      : null;
    if (signupRequestId && !signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    const email = signupRequest
      ? safeString(signupRequest.contact_email).toLowerCase()
      : emailInput;
    const phone = signupRequest ? safeString(signupRequest.contact_phone) : phoneInput;
    if (!phone) {
      return apiError(req, 400, "phone_missing", "Primary contact phone is missing.");
    }
    if (!email) {
      return apiError(req, 400, "email_missing", "Primary contact email is missing.");
    }
    if (signupRequest?.phone_verified) {
      return apiSuccess(req, {
        request_id: signupRequestId || null,
        sent: false,
        verified: true,
      });
    }

    let provider = "supabase_phone";
    try {
      await sendPhoneOtp({ phone });
    } catch (supabaseError) {
      const canUseTwilioFallback = isTwilioVerifyConfigured();
      safeLog(
        "supplier.signup.otp.phone.send.fallback_attempt",
        {
          requestId,
          route: "/api/supplier/signup/otp/phone/send",
          supplierRequestId: signupRequestId,
          hasTwilioFallback: canUseTwilioFallback,
          supabaseReason:
            supabaseError instanceof SupabaseAuthUnavailableError
              ? "supabase_auth_not_configured"
              : supabaseError instanceof SupabaseAuthRequestError
                ? supabaseError.code || "otp_send_failed"
                : "otp_send_failed",
        },
        req
      );

      if (!canUseTwilioFallback) {
        throw supabaseError;
      }
      await sendOtpWithTwilio(phone);
      provider = "twilio_verify";
    }

    const nowIso = new Date().toISOString();
    if (signupRequestId && signupRequest) {
      const existingMeta =
        signupRequest.meta && typeof signupRequest.meta === "object" ? signupRequest.meta : {};
      const nextMeta = {
        ...existingMeta,
        phone_otp_sent_at: nowIso,
        phone_otp_provider: provider,
      };
      await updateSupplierSignupRequest(db, signupRequestId, { meta: nextMeta });
    }

    if (signupRequestId) {
      await logSupplierSignupSystemEvent(db, {
        requestId: signupRequestId,
        event: "supplier_signup_phone_otp_sent",
        message: "Supplier signup phone OTP sent.",
        meta: {
          phone_suffix: phone.slice(-4),
        },
      });
    }

    safeLog(
      "supplier.signup.otp.phone.send.success",
      {
        requestId,
        route: "/api/supplier/signup/otp/phone/send",
        supplierRequestId: signupRequestId,
      },
      req
    );

    const response = apiSuccess(req, {
      request_id: signupRequestId || null,
      sent: true,
    });
    if (!signupRequestId) {
      const existingContext = readSupplierSignupContextFromRequest(req);
      const sameContext =
        existingContext &&
        existingContext.email === email &&
        existingContext.phone === phone;
      setSupplierSignupContextCookie(response, {
        email,
        phone,
        emailOtpProvider: sameContext ? existingContext.emailOtpProvider : undefined,
        phoneOtpProvider: provider as "supabase_phone" | "twilio_verify",
        emailVerified: sameContext ? existingContext.emailVerified : false,
        phoneVerified: sameContext ? existingContext.phoneVerified : false,
      });
    }
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
    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        "Mobile OTP service is unavailable. Please try again later."
      );
    }
    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        "Mobile OTP service is unavailable. Please configure Supabase phone OTP or Twilio Verify."
      );
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "otp_send_failed",
        error.message || "Failed to send mobile OTP. Please retry."
      );
    }
    if (error instanceof TwilioVerifyRequestError) {
      if (error.status === 401 || error.status === 403) {
        return apiError(
          req,
          503,
          "otp_provider_unavailable",
          "Mobile OTP provider authentication failed. Please contact support."
        );
      }
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "otp_send_failed",
        error.message || "Failed to send mobile OTP. Please retry."
      );
    }
    return apiError(req, 500, "otp_send_failed", "Failed to send mobile OTP.");
  }
}
