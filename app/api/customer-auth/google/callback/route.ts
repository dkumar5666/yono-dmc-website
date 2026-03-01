import { NextResponse } from "next/server";
import {
  applyCustomerSessionCookie,
  clearGoogleNextPathCookie,
  clearGoogleStateCookie,
  createCustomerSessionToken,
  readGoogleNextPathFromRequest,
  readGoogleStateFromRequest,
  sanitizeNextPath,
} from "@/lib/backend/customerAuth";
import { getPublicBaseUrl } from "@/lib/auth/baseUrl";
import { upsertCustomer } from "@/lib/backend/customerStore";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { recordAnalyticsEvent, recordRouteDuration } from "@/lib/system/opsTelemetry";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
}

interface GoogleUserInfo {
  sub?: string;
  name?: string;
  email?: string;
}

function loginErrorRedirect(baseUrl: string, code: string, requestId: string): NextResponse {
  const response = NextResponse.redirect(
    `${baseUrl}/login?error=${encodeURIComponent(code)}&rid=${encodeURIComponent(requestId)}`
  );
  response.headers.set("x-request-id", requestId);
  clearGoogleStateCookie(response);
  clearGoogleNextPathCookie(response);
  return response;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  let perfStatusCode = 500;
  let perfOutcome: "success" | "fail" | "warn" = "fail";
  const finalize = (
    response: NextResponse,
    outcome: "success" | "fail" | "warn"
  ): NextResponse => {
    perfStatusCode = response.status;
    perfOutcome = outcome;
    return response;
  };
  try {
    const url = new URL(req.url);
    const baseUrl = getPublicBaseUrl(req);
    const nextPathRaw = readGoogleNextPathFromRequest(req);
    const nextPath = nextPathRaw === "/" ? "/my-trips" : sanitizeNextPath(nextPathRaw);
    const providerError = url.searchParams.get("error");
    safeLog(
      "auth.google.callback.requested",
      {
        requestId,
        route: "/api/customer-auth/google/callback",
        hasCodeParam: Boolean(url.searchParams.get("code")),
        hasStateParam: Boolean(url.searchParams.get("state")),
        hasProviderErrorParam: Boolean(providerError),
      },
      req
    );

    if (providerError) {
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_provider_error",
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_provider_error", requestId), "warn");
    }

    const code = url.searchParams.get("code");
    if (!code) {
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_missing_code",
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_missing_code", requestId), "warn");
    }

    const state = url.searchParams.get("state");
    const expectedState = readGoogleStateFromRequest(req);
    if (!state || !expectedState || state !== expectedState) {
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_state_mismatch",
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_state_mismatch", requestId), "warn");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      console.error("[google-oauth] missing env vars", {
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
      });
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_oauth_not_configured",
          hasGoogleClientId: Boolean(clientId),
          hasGoogleClientSecret: Boolean(clientSecret),
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_oauth_not_configured", requestId), "fail");
    }

    const hasSessionSecret = Boolean(
      process.env.AUTH_SESSION_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim()
    );
    if (process.env.NODE_ENV === "production" && !hasSessionSecret) {
      console.error("[google-oauth] missing session secret", {
        hasAuthSessionSecret: Boolean(process.env.AUTH_SESSION_SECRET?.trim()),
        hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
      });
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "session_secret_missing",
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_oauth_not_configured", requestId), "fail");
    }

    const redirectUri = `${baseUrl}/api/customer-auth/google/callback`;
    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      if (process.env.NODE_ENV !== "production") {
        const tokenErrorText = await tokenRes.text();
        console.error("[google-oauth] token exchange failed", {
          status: tokenRes.status,
          statusText: tokenRes.statusText,
          hasBody: Boolean(tokenErrorText),
        });
      }
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_token_exchange_failed",
          tokenHttpStatus: tokenRes.status,
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_token_exchange_failed", requestId), "warn");
    }

    const tokenJson = await parseJsonSafe<GoogleTokenResponse>(tokenRes);
    if (!tokenJson?.access_token) {
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_token_exchange_failed",
          missingAccessToken: true,
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_token_exchange_failed", requestId), "warn");
    }

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      cache: "no-store",
    });

    if (!userRes.ok) {
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_userinfo_failed",
          userInfoHttpStatus: userRes.status,
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_userinfo_failed", requestId), "warn");
    }

    const user = await parseJsonSafe<GoogleUserInfo>(userRes);
    if (!user?.sub || !user.name) {
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_profile_missing",
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_profile_missing", requestId), "warn");
    }
    if (!user.email) {
      safeLog(
        "auth.google.callback.failed",
        {
          requestId,
          route: "/api/customer-auth/google/callback",
          outcome: "fail",
          reason: "google_email_missing",
        },
        req
      );
      return finalize(loginErrorRedirect(baseUrl, "google_email_missing", requestId), "warn");
    }

    const customer = upsertCustomer({
      provider: "google",
      providerUserId: user.sub,
      fullName: user.name,
      email: user.email,
    });

    const token = createCustomerSessionToken({
      id: customer.id,
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      provider: "google",
    });

    const response = NextResponse.redirect(`${baseUrl}${nextPath}`);
    response.headers.set("x-request-id", requestId);
    applyCustomerSessionCookie(response, token);
    clearGoogleStateCookie(response);
    clearGoogleNextPathCookie(response);
    safeLog(
      "auth.google.callback.success",
      {
        requestId,
        route: "/api/customer-auth/google/callback",
        outcome: "success",
      },
      req
    );
    await recordAnalyticsEvent({
      event: "login_success",
      source: "google",
      status: "success",
      meta: { role: "customer" },
    });
    return finalize(response, "success");
  } catch (error) {
    const url = new URL(req.url);
    console.error("[google-oauth] callback failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      name: error instanceof Error ? error.name : "unknown_error",
      code:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined,
      hasCodeParam: Boolean(url.searchParams.get("code")),
      hasStateParam: Boolean(url.searchParams.get("state")),
      host: req.headers.get("x-forwarded-host") || req.headers.get("host"),
      path: url.pathname,
    });

    safeLog(
      "auth.google.callback.failed",
      {
        requestId,
        route: "/api/customer-auth/google/callback",
        outcome: "fail",
        reason: "google_auth_failed",
        message: error instanceof Error ? error.message : "unknown_error",
        name: error instanceof Error ? error.name : "unknown_error",
      },
      req
    );

    const baseUrl = getPublicBaseUrl(req);
    return finalize(loginErrorRedirect(baseUrl, "google_auth_failed", requestId), "fail");
  } finally {
    await recordRouteDuration({
      route: "/api/customer-auth/google/callback",
      durationMs: Date.now() - startedAt,
      statusCode: perfStatusCode,
      outcome: perfOutcome,
    });
  }
}
