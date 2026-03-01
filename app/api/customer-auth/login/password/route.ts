import { apiError, apiSuccess } from "@/lib/backend/http";
import { applySupabaseSessionCookie, sanitizeNextPath } from "@/lib/auth/supabaseSession";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import {
  signInWithPassword,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import { getCustomerAuthStateByEmail } from "@/lib/auth/customerAuthState";
import { getCustomerProfileCompletionStatus } from "@/lib/backend/customerAccount";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface LoginPasswordBody {
  email?: string;
  password?: string;
  next?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as LoginPasswordBody;
    const email = safeString(body.email).toLowerCase();
    const password = safeString(body.password);
    const nextPath = sanitizeNextPath(body.next);

    safeLog(
      "auth.customer.login.password.requested",
      {
        requestId,
        route: "/api/customer-auth/login/password",
        hasEmail: Boolean(email),
      },
      req
    );

    if (!email || !password) {
      return apiError(req, 400, "CREDENTIALS_REQUIRED", "Email and password are required.");
    }

    const state = await getCustomerAuthStateByEmail(email);
    if (!state || state.role !== "customer") {
      return apiError(req, 404, "NOT_FOUND", "Account not found. Please create account first.");
    }
    const fullyVerified = Boolean(state.emailVerifiedAt) && Boolean(state.phoneVerifiedAt);
    if (!fullyVerified && !state.profileCompleted) {
      return apiError(
        req,
        409,
        "SIGNUP_INCOMPLETE",
        "Please complete account signup before using login."
      );
    }
    const hasUsablePassword = Boolean(state.passwordSetAt) || state.profileCompleted;
    if (!hasUsablePassword) {
      return apiError(
        req,
        409,
        "NO_PASSWORD_SET",
        "Password is not set for this account. Use Email OTP login."
      );
    }

    const tokenPayload = await signInWithPassword({ email, password });
    const userId = safeString(tokenPayload.user?.id);
    if (!userId || !tokenPayload.access_token) {
      return apiError(req, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const profile = await ensureIdentityProfile({
      userId,
      role: "customer",
      trustedRoleAssignment: true,
      email: tokenPayload.user?.email || email,
      phone: tokenPayload.user?.phone || state.phoneE164 || undefined,
      fullName:
        safeString(tokenPayload.user?.user_metadata?.full_name) ||
        safeString(tokenPayload.user?.user_metadata?.name) ||
        undefined,
    });
    if (profile && profile.role !== "customer") {
      return apiError(req, 403, "FORBIDDEN_ROLE", "This account is not configured for customer login.");
    }

    let redirectTo = nextPath || "/my-trips";
    if (redirectTo === "/my-trips") {
      const completed = await getCustomerProfileCompletionStatus(userId);
      if (!completed) redirectTo = "/account/onboarding";
    }

    const response = apiSuccess(req, {
      ok: true,
      redirectTo,
    });
    applySupabaseSessionCookie(response, tokenPayload, {
      userId,
      role: "customer",
      email: tokenPayload.user?.email || state.email || email,
      phone: tokenPayload.user?.phone || state.phoneE164 || undefined,
      fullName: profile?.full_name || undefined,
    });

    safeLog(
      "auth.customer.login.password.success",
      {
        requestId,
        route: "/api/customer-auth/login/password",
      },
      req
    );
    return response;
  } catch (error) {
    safeLog(
      "auth.customer.login.password.failed",
      {
        requestId,
        route: "/api/customer-auth/login/password",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "invalid_credentials"
              : "invalid_credentials",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(req, 503, "AUTH_UNAVAILABLE", "Auth service unavailable.");
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status === 401 || error.status === 400 ? 401 : 502,
        "INVALID_CREDENTIALS",
        "Invalid email or password."
      );
    }
    return apiError(req, 500, "LOGIN_FAILED", "Password login failed.");
  }
}
