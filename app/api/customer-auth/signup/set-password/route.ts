import { apiError, apiSuccess } from "@/lib/backend/http";
import { validatePasswordStrength } from "@/lib/backend/password";
import {
  clearCustomerSignupFlowContext,
  readCustomerSignupFlowContext,
} from "@/lib/auth/customerAuthFlowContext";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import { applySupabaseSessionCookie } from "@/lib/auth/supabaseSession";
import {
  setAuthUserPassword,
  signInWithPassword,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import { persistCustomerAuthState } from "@/lib/auth/customerAuthState";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface SignupSetPasswordBody {
  signup_session_id?: string;
  password?: string;
  confirm_password?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as SignupSetPasswordBody;
    const signupSessionId = safeString(body.signup_session_id);
    const password = safeString(body.password);
    const confirmPassword = safeString(body.confirm_password);

    safeLog(
      "auth.customer.signup.set_password.requested",
      {
        requestId,
        route: "/api/customer-auth/signup/set-password",
        hasSession: Boolean(signupSessionId),
      },
      req
    );

    const context = readCustomerSignupFlowContext(req);
    if (!context || !context.sessionId) {
      return apiError(req, 400, "SIGNUP_SESSION_EXPIRED", "Signup session expired. Start again.");
    }
    if (context.sessionId !== signupSessionId) {
      return apiError(req, 400, "SIGNUP_SESSION_MISMATCH", "Signup session mismatch. Start again.");
    }
    if (!context.emailVerified || !context.phoneVerified || !context.userId) {
      return apiError(
        req,
        400,
        "VERIFICATION_REQUIRED",
        "Complete email and mobile OTP verification first."
      );
    }

    if (!password || !confirmPassword) {
      return apiError(req, 400, "PASSWORD_REQUIRED", "Password and confirm password are required.");
    }
    if (password !== confirmPassword) {
      return apiError(req, 400, "PASSWORD_MISMATCH", "Password and confirm password must match.");
    }
    const strength = validatePasswordStrength(password);
    if (strength) {
      return apiError(req, 400, "PASSWORD_WEAK", strength);
    }

    await setAuthUserPassword({
      userId: context.userId,
      password,
    });

    const tokenPayload = await signInWithPassword({
      email: context.email,
      password,
    });
    const sessionUserId = safeString(tokenPayload.user?.id) || context.userId;

    const profile = await ensureIdentityProfile({
      userId: sessionUserId,
      role: "customer",
      trustedRoleAssignment: true,
      email: tokenPayload.user?.email || context.email,
      phone: context.phone,
      fullName:
        safeString(tokenPayload.user?.user_metadata?.full_name) ||
        safeString(tokenPayload.user?.user_metadata?.name) ||
        undefined,
    });
    if (profile && profile.role !== "customer") {
      return apiError(req, 403, "FORBIDDEN_ROLE", "This account is not available for customer signup.");
    }

    const nowIso = new Date().toISOString();
    await persistCustomerAuthState(sessionUserId, {
      email: tokenPayload.user?.email || context.email,
      phone: context.phone,
      emailVerifiedAt: nowIso,
      phoneVerifiedAt: nowIso,
      authProvider: "local",
      passwordSetAt: nowIso,
      profileCompleted: false,
    });

    const response = apiSuccess(req, {
      ok: true,
      redirectTo: "/account/onboarding",
    });
    applySupabaseSessionCookie(response, tokenPayload, {
      userId: sessionUserId,
      role: "customer",
      email: tokenPayload.user?.email || context.email,
      phone: context.phone,
      fullName: profile?.full_name || undefined,
    });
    clearCustomerSignupFlowContext(response);

    safeLog(
      "auth.customer.signup.set_password.success",
      {
        requestId,
        route: "/api/customer-auth/signup/set-password",
      },
      req
    );

    return response;
  } catch (error) {
    safeLog(
      "auth.customer.signup.set_password.failed",
      {
        requestId,
        route: "/api/customer-auth/signup/set-password",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "set_password_failed"
              : "set_password_failed",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(req, 503, "AUTH_UNAVAILABLE", "Auth service unavailable.");
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "SET_PASSWORD_FAILED",
        error.message || "Failed to set password."
      );
    }
    return apiError(req, 500, "SET_PASSWORD_FAILED", "Failed to complete signup.");
  }
}
