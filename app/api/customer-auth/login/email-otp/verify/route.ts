import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  clearCustomerEmailLoginFlowContext,
  readCustomerEmailLoginFlowContext,
} from "@/lib/auth/customerAuthFlowContext";
import { ensureIdentityProfile, getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import { applySupabaseSessionCookie, sanitizeNextPath } from "@/lib/auth/supabaseSession";
import {
  verifyEmailOtp,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import { getCustomerAuthStateByEmail, persistCustomerAuthState } from "@/lib/auth/customerAuthState";
import { getCustomerProfileCompletionStatus } from "@/lib/backend/customerAccount";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface EmailOtpVerifyBody {
  login_session_id?: string;
  otp?: string;
  next?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as EmailOtpVerifyBody;
    const loginSessionId = safeString(body.login_session_id);
    const otp = safeString(body.otp);
    const nextPath = sanitizeNextPath(body.next);

    safeLog(
      "auth.customer.login.email_otp.verify.requested",
      {
        requestId,
        route: "/api/customer-auth/login/email-otp/verify",
        hasSession: Boolean(loginSessionId),
      },
      req
    );

    const context = readCustomerEmailLoginFlowContext(req);
    if (!context || !context.sessionId) {
      return apiError(req, 400, "LOGIN_SESSION_EXPIRED", "Email login session expired. Start again.");
    }
    if (context.sessionId !== loginSessionId) {
      return apiError(req, 400, "LOGIN_SESSION_MISMATCH", "Email login session mismatch. Start again.");
    }
    if (!otp) {
      return apiError(req, 400, "OTP_REQUIRED", "OTP is required.");
    }

    const state = await getCustomerAuthStateByEmail(context.email);
    if (!state || state.role !== "customer") {
      return apiError(req, 404, "NOT_FOUND", "Account not found. Please create account first.");
    }

    const tokenPayload = await verifyEmailOtp({
      email: context.email,
      token: otp,
    });
    const userId = safeString(tokenPayload.user?.id);
    if (!userId || !tokenPayload.access_token) {
      return apiError(req, 401, "OTP_INVALID", "Email OTP verification failed.");
    }

    const identity = await getIdentityProfileByUserId(userId);
    if (identity && identity.role !== "customer") {
      return apiError(req, 403, "FORBIDDEN_ROLE", "This account is not configured for customer login.");
    }
    const profile = await ensureIdentityProfile({
      userId,
      role: "customer",
      trustedRoleAssignment: true,
      email: tokenPayload.user?.email || context.email,
      phone: tokenPayload.user?.phone || state.phoneE164 || undefined,
      fullName:
        safeString(tokenPayload.user?.user_metadata?.full_name) ||
        safeString(tokenPayload.user?.user_metadata?.name) ||
        undefined,
    });

    const nowIso = new Date().toISOString();
    await persistCustomerAuthState(userId, {
      email: tokenPayload.user?.email || context.email,
      emailVerifiedAt: nowIso,
      authProvider: state.authProvider || "local",
    });

    let redirectTo = nextPath || "/my-trips";
    if (redirectTo === "/my-trips") {
      const completed = await getCustomerProfileCompletionStatus(userId);
      if (!completed) {
        redirectTo = "/account/onboarding";
      }
    }

    const response = apiSuccess(req, {
      ok: true,
      redirectTo,
    });
    applySupabaseSessionCookie(response, tokenPayload, {
      userId,
      role: "customer",
      email: tokenPayload.user?.email || context.email,
      phone: tokenPayload.user?.phone || state.phoneE164 || undefined,
      fullName: profile?.full_name || undefined,
    });
    clearCustomerEmailLoginFlowContext(response);

    safeLog(
      "auth.customer.login.email_otp.verify.success",
      {
        requestId,
        route: "/api/customer-auth/login/email-otp/verify",
      },
      req
    );
    return response;
  } catch (error) {
    safeLog(
      "auth.customer.login.email_otp.verify.failed",
      {
        requestId,
        route: "/api/customer-auth/login/email-otp/verify",
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
      return apiError(req, 503, "OTP_PROVIDER_UNAVAILABLE", "OTP service temporarily unavailable.");
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(req, 401, "OTP_INVALID", "Email OTP verification failed.");
    }
    return apiError(req, 500, "OTP_VERIFY_FAILED", "Failed to verify email OTP.");
  }
}

