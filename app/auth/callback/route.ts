import { NextResponse } from "next/server";
import { getPublicBaseUrl } from "@/lib/auth/baseUrl";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import {
  applySupabaseSessionCookie,
  clearOAuthContextCookie,
  readOAuthContextFromRequest,
  sanitizeNextPath,
} from "@/lib/auth/supabaseSession";
import {
  exchangeOAuthCodeForSession,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

function loginErrorRedirect(baseUrl: string, code: string, requestId: string): NextResponse {
  const response = NextResponse.redirect(
    `${baseUrl}/login?error=${encodeURIComponent(code)}&rid=${encodeURIComponent(requestId)}`
  );
  response.headers.set("x-request-id", requestId);
  clearOAuthContextCookie(response);
  return response;
}

function safeUserName(user: { user_metadata?: Record<string, unknown> } | undefined): string | undefined {
  if (!user?.user_metadata || typeof user.user_metadata !== "object") return undefined;
  const fullName = user.user_metadata.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  const name = user.user_metadata.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return undefined;
}

function postLoginPath(role: string | undefined, requested: string): string {
  const nextPath = sanitizeNextPath(requested);
  if (nextPath && nextPath !== "/") return nextPath;
  if (role === "admin") return "/admin/control-center";
  if (role === "supplier") return "/supplier/dashboard";
  return "/my-trips";
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const baseUrl = getPublicBaseUrl(req);
  const url = new URL(req.url);

  try {
    safeLog(
      "auth.supabase.google.callback.requested",
      {
        requestId,
        route: "/auth/callback",
        hasCodeParam: Boolean(url.searchParams.get("code")),
        hasStateParam: Boolean(url.searchParams.get("state")),
        hasProviderError: Boolean(url.searchParams.get("error")),
      },
      req
    );

    if (url.searchParams.get("error")) {
      return loginErrorRedirect(baseUrl, "google_provider_error", requestId);
    }

    const code = url.searchParams.get("code");
    if (!code) {
      return loginErrorRedirect(baseUrl, "google_missing_code", requestId);
    }

    const context = readOAuthContextFromRequest(req);
    if (!context) {
      return loginErrorRedirect(baseUrl, "google_state_mismatch", requestId);
    }

    const tokenPayload = await exchangeOAuthCodeForSession({
      authCode: code,
      codeVerifier: context.verifier,
    });

    const userId = tokenPayload.user?.id?.trim();
    if (!userId || !tokenPayload.access_token) {
      return loginErrorRedirect(baseUrl, "google_token_exchange_failed", requestId);
    }

    const profile = await ensureIdentityProfile({
      userId,
      role: context.role,
      email: tokenPayload.user?.email,
      phone: tokenPayload.user?.phone,
      fullName: context.fullName || safeUserName(tokenPayload.user),
      companyName: context.companyName,
      governmentId: context.governmentId,
      taxId: context.taxId,
      officeAddress: context.officeAddress,
      city: context.city,
    });

    const role = profile?.role;
    const response = NextResponse.redirect(`${baseUrl}${postLoginPath(role, context.nextPath)}`);
    response.headers.set("x-request-id", requestId);
    applySupabaseSessionCookie(response, tokenPayload, {
      userId,
      email: tokenPayload.user?.email || profile?.email || undefined,
      phone: tokenPayload.user?.phone || profile?.phone || undefined,
      fullName: context.fullName || safeUserName(tokenPayload.user) || profile?.full_name || undefined,
      role,
    });
    clearOAuthContextCookie(response);

    safeLog(
      "auth.supabase.google.callback.success",
      {
        requestId,
        route: "/auth/callback",
        outcome: "success",
        role: role || "customer",
      },
      req
    );

    return response;
  } catch (error) {
    safeLog(
      "auth.supabase.google.callback.failed",
      {
        requestId,
        route: "/auth/callback",
        outcome: "fail",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "supabase_auth_request_failed"
              : "google_auth_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return loginErrorRedirect(baseUrl, "supabase_auth_not_configured", requestId);
    }
    if (error instanceof SupabaseAuthRequestError) {
      if (error.status >= 400 && error.status < 500) {
        return loginErrorRedirect(baseUrl, "google_token_exchange_failed", requestId);
      }
      return loginErrorRedirect(baseUrl, "google_auth_failed", requestId);
    }
    return loginErrorRedirect(baseUrl, "google_auth_failed", requestId);
  }
}
