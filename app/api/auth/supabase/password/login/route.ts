import { apiError, apiSuccess } from "@/lib/backend/http";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import { normalizeRole, applySupabaseSessionCookie } from "@/lib/auth/supabaseSession";
import {
  signInWithPassword,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { applySessionCookie, createSessionToken, UserRole } from "@/lib/backend/sessionAuth";

interface PasswordLoginBody {
  email?: string;
  password?: string;
  expectedRole?: string;
  expectedRoles?: string[];
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapLegacyAdminRole(role: string): UserRole | null {
  if (role === "admin") return "admin";
  if (role === "staff") return "admin";
  if (role === "editor") return "editor";
  return null;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as PasswordLoginBody;
    const email = safeString(body.email).toLowerCase();
    const password = safeString(body.password);
    const expectedRole = normalizeRole(body.expectedRole);
    const expectedRoles = Array.isArray(body.expectedRoles)
      ? body.expectedRoles
          .map((role) => normalizeRole(role))
          .filter((role): role is NonNullable<ReturnType<typeof normalizeRole>> => Boolean(role))
      : [];
    const acceptedRoles = expectedRole
      ? [expectedRole]
      : expectedRoles.length > 0
        ? expectedRoles
        : [];

    safeLog(
      "auth.supabase.password.login.requested",
      {
        requestId,
        route: "/api/auth/supabase/password/login",
        hasExpectedRole: acceptedRoles.length > 0,
      },
      req
    );

    if (!email || !password) {
      return apiError(req, 400, "credentials_required", "Email and password are required.");
    }

    const tokenPayload = await signInWithPassword({ email, password });
    const userId = safeString(tokenPayload.user?.id);
    if (!userId || !tokenPayload.access_token) {
      return apiError(req, 401, "invalid_credentials", "Login failed.");
    }

    const profile = await ensureIdentityProfile({
      userId,
      email: tokenPayload.user?.email || email,
      phone: tokenPayload.user?.phone,
      fullName:
        safeString(tokenPayload.user?.user_metadata?.full_name) ||
        safeString(tokenPayload.user?.user_metadata?.name) ||
        undefined,
    });

    const resolvedRole = profile?.role || "customer";
    if (acceptedRoles.length > 0 && !acceptedRoles.includes(resolvedRole)) {
      return apiError(req, 403, "role_not_allowed", "This account is not allowed for this portal.");
    }

    const response = apiSuccess(req, {
      loggedIn: true,
      role: resolvedRole,
    });
    response.headers.set("x-request-id", requestId);
    applySupabaseSessionCookie(response, tokenPayload, {
      userId,
      email: tokenPayload.user?.email || profile?.email || email,
      phone: tokenPayload.user?.phone || profile?.phone || undefined,
      fullName:
        safeString(tokenPayload.user?.user_metadata?.full_name) ||
        safeString(tokenPayload.user?.user_metadata?.name) ||
        profile?.full_name ||
        undefined,
      role: resolvedRole,
    });

    const legacyRole = mapLegacyAdminRole(resolvedRole);
    if (legacyRole === "admin") {
      const legacyToken = createSessionToken({
        username: email,
        role: "admin",
      });
      applySessionCookie(response, legacyToken);
    }

    safeLog(
      "auth.supabase.password.login.success",
      {
        requestId,
        route: "/api/auth/supabase/password/login",
        outcome: "success",
        role: resolvedRole,
      },
      req
    );

    return response;
  } catch (error) {
    safeLog(
      "auth.supabase.password.login.failed",
      {
        requestId,
        route: "/api/auth/supabase/password/login",
        outcome: "fail",
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
      return apiError(
        req,
        503,
        "supabase_auth_not_configured",
        "Supabase Auth is not configured."
      );
    }

    if (error instanceof SupabaseAuthRequestError) {
      const status = error.status === 400 || error.status === 401 ? 401 : 502;
      const code = status === 401 ? "invalid_credentials" : "auth_provider_unavailable";
      return apiError(req, status, code, error.message);
    }

    return apiError(req, 500, "login_failed", "Login failed.");
  }
}
