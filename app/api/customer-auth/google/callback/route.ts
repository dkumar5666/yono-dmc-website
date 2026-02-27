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

function loginErrorRedirect(baseUrl: string, code: string): NextResponse {
  const response = NextResponse.redirect(
    `${baseUrl}/login?error=${encodeURIComponent(code)}`
  );
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
  try {
    const url = new URL(req.url);
    const baseUrl = getPublicBaseUrl(req);
    const nextPathRaw = readGoogleNextPathFromRequest(req);
    const nextPath = nextPathRaw === "/" ? "/my-trips" : sanitizeNextPath(nextPathRaw);
    const hasCodeParam = Boolean(url.searchParams.get("code"));
    const hasStateParam = Boolean(url.searchParams.get("state"));
    const providerError = url.searchParams.get("error");

    if (providerError) {
      return loginErrorRedirect(baseUrl, "google_provider_error");
    }

    const code = url.searchParams.get("code");
    if (!code) {
      return loginErrorRedirect(baseUrl, "google_missing_code");
    }

    const state = url.searchParams.get("state");
    const expectedState = readGoogleStateFromRequest(req);
    if (!state || !expectedState || state !== expectedState) {
      return loginErrorRedirect(baseUrl, "google_state_mismatch");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      console.error("[google-oauth] missing env vars", {
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
      });
      return loginErrorRedirect(baseUrl, "google_oauth_not_configured");
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
      return loginErrorRedirect(baseUrl, "google_token_exchange_failed");
    }

    const tokenJson = await parseJsonSafe<GoogleTokenResponse>(tokenRes);
    if (!tokenJson?.access_token) {
      return loginErrorRedirect(baseUrl, "google_token_exchange_failed");
    }

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      cache: "no-store",
    });

    if (!userRes.ok) {
      return loginErrorRedirect(baseUrl, "google_userinfo_failed");
    }

    const user = await parseJsonSafe<GoogleUserInfo>(userRes);
    if (!user?.sub || !user.name) {
      return loginErrorRedirect(baseUrl, "google_profile_missing");
    }
    if (!user.email) {
      return loginErrorRedirect(baseUrl, "google_email_missing");
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
    applyCustomerSessionCookie(response, token);
    clearGoogleStateCookie(response);
    clearGoogleNextPathCookie(response);
    return response;
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

    const baseUrl = getPublicBaseUrl(req);
    return loginErrorRedirect(baseUrl, "google_auth_failed");
  }
}
