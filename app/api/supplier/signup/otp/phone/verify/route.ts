import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
  verifyPhoneOtp,
} from "@/lib/auth/supabaseAuthProvider";
import {
  verifyOtpWithTwilio,
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

interface VerifyPhoneOtpBody {
  request_id?: string;
  email?: string;
  phone?: string;
  otp?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_phone_otp_verify",
    maxRequests: 30,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many verification attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as VerifyPhoneOtpBody;
    const signupRequestId = safeString(body.request_id);
    const emailInput = normalizeEmail(body.email);
    const phoneInput = normalizePhone(body.phone);
    const otp = safeString(body.otp);

    if (!signupRequestId && !phoneInput) {
      return apiError(req, 400, "phone_required", "Primary contact phone is required.");
    }
    if (!otp) {
      return apiError(req, 400, "otp_required", "OTP is required.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = signupRequestId
      ? await getSupplierSignupRequestById(db, signupRequestId)
      : null;
    if (signupRequestId && !signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    if (signupRequest?.phone_verified) {
      return apiSuccess(req, {
        request_id: signupRequestId || null,
        verified: true,
      });
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

    const context = !signupRequestId ? readSupplierSignupContextFromRequest(req) : null;
    if (!signupRequestId) {
      if (!context || context.phone !== phone) {
        return apiError(req, 400, "verification_context_missing", "Send mobile OTP first.");
      }
      if (email && context.email !== email) {
        return apiError(req, 400, "verification_context_mismatch", "Email mismatch.");
      }
    }

    const meta = safeObject(signupRequest?.meta);
    const provider =
      safeString(meta.phone_otp_provider) ||
      safeString(context?.phoneOtpProvider) ||
      "twilio_verify";

    if (provider.startsWith("supabase")) {
      await verifyPhoneOtp({
        phone,
        token: otp,
      });
    } else {
      const verify = await verifyOtpWithTwilio({
        phone,
        token: otp,
      });
      if (!verify.approved) {
        return apiError(req, 401, "otp_invalid", "Invalid OTP.");
      }
    }

    if (signupRequestId) {
      await updateSupplierSignupRequest(db, signupRequestId, { phone_verified: true });
      await logSupplierSignupSystemEvent(db, {
        requestId: signupRequestId,
        event: "supplier_signup_phone_verified",
        message: "Supplier signup phone verified.",
      });
    }

    safeLog(
      "supplier.signup.otp.phone.verify.success",
      {
        requestId,
        route: "/api/supplier/signup/otp/phone/verify",
        supplierRequestId: signupRequestId,
      },
      req
    );

    const response = apiSuccess(req, {
      request_id: signupRequestId || null,
      verified: true,
    });
    if (!signupRequestId && context) {
      setSupplierSignupContextCookie(response, {
        email: context.email,
        phone: context.phone,
        emailOtpProvider: context.emailOtpProvider,
        phoneOtpProvider: context.phoneOtpProvider,
        emailVerified: context.emailVerified,
        phoneVerified: true,
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
        "Mobile OTP service is unavailable. Please configure Supabase phone OTP."
      );
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 401,
        "otp_invalid",
        "Failed to verify mobile OTP."
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
        error.status >= 500 ? 502 : 401,
        "otp_invalid",
        "Failed to verify mobile OTP."
      );
    }
    return apiError(req, 500, "otp_invalid", "Failed to verify mobile OTP.");
  }
}
