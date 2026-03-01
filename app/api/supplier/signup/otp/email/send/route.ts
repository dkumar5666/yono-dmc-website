import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  sendEmailOtp,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import {
  sendEmailOtpWithTwilio,
  isTwilioVerifyConfigured,
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

interface SendEmailOtpBody {
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
    namespace: "supplier_signup_email_otp_send",
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
    const body = (await req.json().catch(() => ({}))) as SendEmailOtpBody;
    const signupRequestId = safeString(body.request_id);
    const emailInput = normalizeEmail(body.email);
    const phoneInput = normalizePhone(body.phone);

    if (!signupRequestId) {
      if (!emailInput) {
        return apiError(req, 400, "email_required", "Primary contact email is required.");
      }
      if (!phoneInput) {
        return apiError(req, 400, "phone_required", "Primary contact mobile is required.");
      }
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
    if (!email) return apiError(req, 400, "email_missing", "Primary contact email is missing.");
    if (!phone) return apiError(req, 400, "phone_missing", "Primary contact mobile is missing.");

    if (signupRequest?.email_verified) {
      return apiSuccess(req, {
        request_id: signupRequestId || null,
        sent: false,
        verified: true,
      });
    }

    let provider = "supabase_email";
    try {
      await sendEmailOtp({ email });
    } catch (supabaseError) {
      const canUseTwilioFallback = isTwilioVerifyConfigured();
      safeLog(
        "supplier.signup.otp.email.send.fallback_attempt",
        {
          requestId,
          route: "/api/supplier/signup/otp/email/send",
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
      await sendEmailOtpWithTwilio(email);
      provider = "twilio_verify_email";
    }

    const nowIso = new Date().toISOString();
    if (signupRequestId && signupRequest) {
      const existingMeta =
        signupRequest.meta && typeof signupRequest.meta === "object" ? signupRequest.meta : {};
      const nextMeta = {
        ...existingMeta,
        email_otp_sent_at: nowIso,
        email_otp_provider: provider,
      };
      await updateSupplierSignupRequest(db, signupRequestId, { meta: nextMeta });
    }

    if (signupRequestId) {
      await logSupplierSignupSystemEvent(db, {
        requestId: signupRequestId,
        event: "supplier_signup_email_otp_sent",
        message: "Supplier signup email OTP sent.",
        meta: {
          email: email.replace(/(.{2}).+(@.*)/, "$1***$2"),
        },
      });
    }

    safeLog(
      "supplier.signup.otp.email.send.success",
      {
        requestId,
        route: "/api/supplier/signup/otp/email/send",
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
        emailOtpProvider: provider as "supabase_email" | "twilio_verify_email",
        phoneOtpProvider: sameContext ? existingContext.phoneOtpProvider : undefined,
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
        "Email OTP service is unavailable. Please try again later."
      );
    }
    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        "Email OTP service is unavailable. Please configure Supabase email OTP or Twilio Verify email."
      );
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "otp_send_failed",
        error.message || "Failed to send email OTP. Please retry."
      );
    }
    if (error instanceof TwilioVerifyRequestError) {
      if (error.status === 401 || error.status === 403) {
        return apiError(
          req,
          503,
          "otp_provider_unavailable",
          "Email OTP provider authentication failed. Please contact support."
        );
      }
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "otp_send_failed",
        error.message || "Failed to send email OTP. Please retry."
      );
    }
    return apiError(req, 500, "otp_send_failed", "Failed to send email OTP.");
  }
}
