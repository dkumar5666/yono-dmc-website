import { apiError, apiSuccess } from "@/lib/backend/http";
import {
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
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface SendPhoneOtpBody {
  request_id?: string;
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
    if (!signupRequestId) {
      return apiError(req, 400, "request_id_required", "request_id is required.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, signupRequestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    const phone = safeString(signupRequest.contact_phone);
    if (!phone) {
      return apiError(req, 400, "phone_missing", "Primary contact phone is missing.");
    }
    if (signupRequest.phone_verified) {
      return apiSuccess(req, {
        request_id: signupRequestId,
        sent: false,
        verified: true,
      });
    }

    await sendOtpWithTwilio(phone);
    const nowIso = new Date().toISOString();
    const existingMeta =
      signupRequest.meta && typeof signupRequest.meta === "object" ? signupRequest.meta : {};
    const nextMeta = {
      ...existingMeta,
      phone_otp_sent_at: nowIso,
      phone_otp_provider: "twilio_verify",
    };
    await updateSupplierSignupRequest(db, signupRequestId, { meta: nextMeta });

    await logSupplierSignupSystemEvent(db, {
      requestId: signupRequestId,
      event: "supplier_signup_phone_otp_sent",
      message: "Supplier signup phone OTP sent.",
      meta: {
        phone_suffix: phone.slice(-4),
      },
    });

    safeLog(
      "supplier.signup.otp.phone.send.success",
      {
        requestId,
        route: "/api/supplier/signup/otp/phone/send",
        supplierRequestId: signupRequestId,
      },
      req
    );

    return apiSuccess(req, {
      request_id: signupRequestId,
      sent: true,
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
    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        "Mobile OTP service is unavailable. Please try again later."
      );
    }
    if (error instanceof TwilioVerifyRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "otp_send_failed",
        "Failed to send mobile OTP. Please retry."
      );
    }
    return apiError(req, 500, "otp_send_failed", "Failed to send mobile OTP.");
  }
}
