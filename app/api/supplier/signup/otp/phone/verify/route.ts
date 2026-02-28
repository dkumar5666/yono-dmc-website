import { apiError, apiSuccess } from "@/lib/backend/http";
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
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface VerifyPhoneOtpBody {
  request_id?: string;
  otp?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
    const otp = safeString(body.otp);

    if (!signupRequestId) {
      return apiError(req, 400, "request_id_required", "request_id is required.");
    }
    if (!otp) {
      return apiError(req, 400, "otp_required", "OTP is required.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, signupRequestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    if (signupRequest.phone_verified) {
      return apiSuccess(req, {
        request_id: signupRequestId,
        verified: true,
      });
    }

    const phone = safeString(signupRequest.contact_phone);
    if (!phone) {
      return apiError(req, 400, "phone_missing", "Primary contact phone is missing.");
    }

    const verify = await verifyOtpWithTwilio({
      phone,
      token: otp,
    });
    if (!verify.approved) {
      return apiError(req, 401, "otp_invalid", "Invalid OTP.");
    }

    await updateSupplierSignupRequest(db, signupRequestId, { phone_verified: true });
    await logSupplierSignupSystemEvent(db, {
      requestId: signupRequestId,
      event: "supplier_signup_phone_verified",
      message: "Supplier signup phone verified.",
    });

    safeLog(
      "supplier.signup.otp.phone.verify.success",
      {
        requestId,
        route: "/api/supplier/signup/otp/phone/verify",
        supplierRequestId: signupRequestId,
      },
      req
    );

    return apiSuccess(req, {
      request_id: signupRequestId,
      verified: true,
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
        error.status >= 500 ? 502 : 401,
        "otp_invalid",
        "Failed to verify mobile OTP."
      );
    }
    return apiError(req, 500, "otp_invalid", "Failed to verify mobile OTP.");
  }
}
