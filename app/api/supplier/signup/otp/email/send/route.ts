import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  sendEmailOtpWithTwilio,
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

interface SendEmailOtpBody {
  request_id?: string;
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
    if (!signupRequestId) {
      return apiError(req, 400, "request_id_required", "request_id is required.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, signupRequestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    const email = safeString(signupRequest.contact_email).toLowerCase();
    if (!email) {
      return apiError(req, 400, "email_missing", "Primary contact email is missing.");
    }

    if (signupRequest.email_verified) {
      return apiSuccess(req, {
        request_id: signupRequestId,
        sent: false,
        verified: true,
      });
    }

    await sendEmailOtpWithTwilio(email);
    const nowIso = new Date().toISOString();
    const existingMeta =
      signupRequest.meta && typeof signupRequest.meta === "object" ? signupRequest.meta : {};
    const nextMeta = {
      ...existingMeta,
      email_otp_sent_at: nowIso,
      email_otp_provider: "twilio_verify",
    };
    await updateSupplierSignupRequest(db, signupRequestId, { meta: nextMeta });

    await logSupplierSignupSystemEvent(db, {
      requestId: signupRequestId,
      event: "supplier_signup_email_otp_sent",
      message: "Supplier signup email OTP sent.",
      meta: {
        email: email.replace(/(.{2}).+(@.*)/, "$1***$2"),
      },
    });

    safeLog(
      "supplier.signup.otp.email.send.success",
      {
        requestId,
        route: "/api/supplier/signup/otp/email/send",
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
        "Email OTP service is unavailable. Please try again later."
      );
    }
    if (error instanceof TwilioVerifyRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "otp_send_failed",
        "Failed to send email OTP. Please retry."
      );
    }
    return apiError(req, 500, "otp_send_failed", "Failed to send email OTP.");
  }
}
