import { apiError, apiSuccess } from "@/lib/backend/http";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import { applySupabaseSessionCookie, sanitizeNextPath } from "@/lib/auth/supabaseSession";
import {
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
  verifyEmailOtp,
} from "@/lib/auth/supabaseAuthProvider";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { recordAnalyticsEvent } from "@/lib/system/opsTelemetry";
import { getCustomerProfileCompletionStatus } from "@/lib/backend/customerAccount";

const OTP_UNAVAILABLE_MESSAGE =
  "OTP service temporarily unavailable, please try Google login or retry in 2 minutes.";

interface VerifyEmailOtpBody {
  email?: string;
  token?: string;
  next?: string;
}

function normalizeEmail(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as VerifyEmailOtpBody;
    const email = normalizeEmail(body.email);
    const token = (body.token || "").trim();

    safeLog(
      "auth.supabase.email_otp.verify.requested",
      {
        requestId,
        route: "/api/auth/supabase/email-otp/verify",
      },
      req
    );

    if (!email) {
      return apiError(req, 400, "missing_email", "Email is required.");
    }
    if (!isValidEmail(email)) {
      return apiError(req, 400, "invalid_email", "Enter a valid email address.");
    }
    if (!token) {
      return apiError(req, 400, "otp_invalid", "OTP code is required.");
    }

    const tokenPayload = await verifyEmailOtp({ email, token });
    const userId = tokenPayload.user?.id?.trim();
    if (!userId || !tokenPayload.access_token) {
      return apiError(req, 401, "otp_invalid", "OTP verification failed.");
    }

    const profile = await ensureIdentityProfile({
      userId,
      role: "customer",
      email: tokenPayload.user?.email || email,
      phone: tokenPayload.user?.phone,
    });
    const resolvedRole = profile?.role || "customer";
    if (resolvedRole !== "customer") {
      return apiError(req, 403, "forbidden_role", "This account is not configured for customer login.");
    }

    let nextPath = sanitizeNextPath(body.next);
    if (nextPath === "/my-trips") {
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
    applySupabaseSessionCookie(response, tokenPayload, {
      userId,
      email: tokenPayload.user?.email || profile?.email || email,
      phone: tokenPayload.user?.phone || profile?.phone || undefined,
      fullName: profile?.full_name || undefined,
      role: resolvedRole,
    });

    safeLog(
      "auth.supabase.email_otp.verify.success",
      {
        requestId,
        route: "/api/auth/supabase/email-otp/verify",
        outcome: "success",
        role: resolvedRole,
      },
      req
    );
    await recordAnalyticsEvent({
      event: "login_success",
      source: "email_otp",
      status: "success",
      meta: { role: resolvedRole },
    });

    return response;
  } catch (error) {
    safeLog(
      "auth.supabase.email_otp.verify.failed",
      {
        requestId,
        route: "/api/auth/supabase/email-otp/verify",
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
      return apiError(req, 503, "supabase_auth_not_configured", OTP_UNAVAILABLE_MESSAGE);
    }
    if (error instanceof SupabaseAuthRequestError) {
      const code = error.status === 400 || error.status === 422 ? "otp_invalid" : "otp_provider_unavailable";
      return apiError(
        req,
        error.status >= 500 ? 502 : 401,
        code,
        code === "otp_provider_unavailable" ? OTP_UNAVAILABLE_MESSAGE : error.message
      );
    }

    return apiError(req, 500, "otp_invalid", "Failed to verify email OTP.");
  }
}

