import { apiError, apiSuccess } from "@/lib/backend/http";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import {
  applySupabaseSessionCookie,
  clearOtpContextCookie,
  readOtpContextFromRequest,
  sanitizeNextPath,
} from "@/lib/auth/supabaseSession";
import {
  createPasswordSessionForVerifiedPhone,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
  verifyPhoneOtp,
} from "@/lib/auth/supabaseAuthProvider";
import {
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
  verifyOtpWithTwilio,
} from "@/lib/auth/twilioVerifyFallback";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { recordAnalyticsEvent } from "@/lib/system/opsTelemetry";
import { getCustomerProfileCompletionStatus } from "@/lib/backend/customerAccount";

const OTP_UNAVAILABLE_MESSAGE =
  "OTP service temporarily unavailable, please try Google login or retry in 2 minutes.";

interface VerifyOtpBody {
  phone?: string;
  token?: string;
}

function normalizePhone(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as VerifyOtpBody;
    const phone = normalizePhone(body.phone);
    const token = (body.token || "").trim();
    const context = readOtpContextFromRequest(req);

    safeLog(
      "auth.supabase.otp.verify.requested",
      {
        requestId,
        route: "/api/auth/supabase/otp/verify",
        hasChallenge: Boolean(context),
        provider: context?.provider || "unknown",
      },
      req
    );

    if (!phone) {
      return apiError(req, 400, "missing_phone", "Phone number is required.");
    }
    if (!token) {
      return apiError(req, 400, "otp_invalid", "OTP code is required.");
    }
    if (!context) {
      return apiError(req, 400, "otp_expired", "OTP challenge has expired. Request a new code.");
    }
    if (context.phone !== phone) {
      return apiError(req, 400, "otp_invalid", "OTP challenge does not match phone number.");
    }

    let tokenPayload: Awaited<ReturnType<typeof verifyPhoneOtp>> | null = null;
    if (context.provider === "twilio_verify") {
      const twilioResult = await verifyOtpWithTwilio({ phone, token });
      if (!twilioResult.approved) {
        return apiError(req, 401, "otp_invalid", "Invalid OTP.");
      }
      tokenPayload = await createPasswordSessionForVerifiedPhone({
        phone,
        fullName: context.fullName,
      });
    }

    if (!tokenPayload) {
      tokenPayload = await verifyPhoneOtp({ phone, token });
    }
    const userId = tokenPayload.user?.id?.trim();
    if (!userId || !tokenPayload.access_token) {
      return apiError(req, 401, "otp_invalid", "OTP verification failed.");
    }

    const profile = await ensureIdentityProfile({
      userId,
      role: context.role,
      fullName: context.fullName,
      companyName: context.companyName,
      governmentId: context.governmentId,
      taxId: context.taxId,
      officeAddress: context.officeAddress,
      city: context.city,
      email: tokenPayload.user?.email,
      phone: tokenPayload.user?.phone || phone,
    });

    const resolvedRole = profile?.role || "customer";
    let nextPath = sanitizeNextPath(context.nextPath);
    if (resolvedRole === "customer" && nextPath === "/my-trips") {
      const completed = await getCustomerProfileCompletionStatus(userId);
      if (!completed) {
        nextPath = "/account/onboarding";
      }
    }

    const response = apiSuccess(req, {
      verified: true,
      role: resolvedRole,
      nextPath,
    });
    response.headers.set("x-request-id", requestId);
    applySupabaseSessionCookie(response, tokenPayload, {
      userId,
      email: tokenPayload.user?.email || profile?.email || undefined,
      phone: tokenPayload.user?.phone || profile?.phone || phone,
      fullName: context.fullName || profile?.full_name || undefined,
      role: resolvedRole,
    });
    clearOtpContextCookie(response);

    safeLog(
      "auth.supabase.otp.verify.success",
      {
        requestId,
        route: "/api/auth/supabase/otp/verify",
        outcome: "success",
        role: resolvedRole,
        provider: context.provider,
      },
      req
    );
    await recordAnalyticsEvent({
      event: "login_success",
      source: context.provider === "twilio_verify" ? "mobile_otp_twilio" : "mobile_otp",
      status: "success",
      meta: {
        role: resolvedRole,
      },
    });

    return response;
  } catch (error) {
    safeLog(
      "auth.supabase.otp.verify.failed",
      {
        requestId,
        route: "/api/auth/supabase/otp/verify",
        outcome: "fail",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "otp_invalid"
              : "otp_invalid",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(
        req,
        503,
        "supabase_auth_not_configured",
        OTP_UNAVAILABLE_MESSAGE
      );
    }

    if (error instanceof SupabaseAuthRequestError) {
      const code =
        error.status === 400 || error.status === 422 ? "otp_invalid" : "otp_provider_unavailable";
      return apiError(
        req,
        error.status >= 500 ? 502 : 401,
        code,
        code === "otp_provider_unavailable" ? OTP_UNAVAILABLE_MESSAGE : error.message
      );
    }

    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(req, 503, "otp_provider_unavailable", OTP_UNAVAILABLE_MESSAGE);
    }

    if (error instanceof TwilioVerifyRequestError) {
      const code = error.status === 400 || error.status === 404 ? "otp_invalid" : "otp_provider_unavailable";
      return apiError(
        req,
        error.status >= 500 ? 502 : 401,
        code,
        code === "otp_provider_unavailable" ? OTP_UNAVAILABLE_MESSAGE : error.message
      );
    }

    return apiError(req, 500, "otp_invalid", "Failed to verify OTP.");
  }
}
