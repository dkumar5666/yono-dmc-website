import { NextResponse } from "next/server";
import {
  applyGoogleNextPathCookie,
  applyGoogleStateCookie,
  createGoogleOauthState,
  sanitizeNextPath,
} from "@/lib/backend/customerAuth";
import { getPublicBaseUrl } from "@/lib/auth/baseUrl";
import { apiError } from "@/lib/backend/http";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const limit = consumeRateLimit(`google-oauth-start:${ip}`, 30, 15 * 60 * 1000);
  if (!limit.ok) {
    const response = apiError(
      req,
      429,
      "RATE_LIMITED",
      "Too many login attempts. Try again later.",
      { retryAfterSeconds: limit.retryAfterSeconds }
    );
    response.headers.set("retry-after", String(limit.retryAfterSeconds));
    return response;
  }

  const requestUrl = new URL(req.url);
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return apiError(
      req,
      500,
      "GOOGLE_ENV_MISSING",
      "Google OAuth not configured: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET"
    );
  }

  const state = createGoogleOauthState();
  const redirectUri = `${getPublicBaseUrl(req)}/api/customer-auth/google/callback`;
  if (process.env.NODE_ENV !== "production") {
    console.log("[google-oauth] redirect_uri =", redirectUri);
  }

  const authUrl = new URL(GOOGLE_AUTH_URL);
  /*
   * Google Cloud OAuth Client configuration (Customer Login)
   * Authorized redirect URIs:
   * 1) https://yonodmc.in/api/customer-auth/google/callback
   * 2) https://www.yonodmc.in/api/customer-auth/google/callback
   * 3) http://localhost:3000/api/customer-auth/google/callback
   *
   * Authorized JavaScript origins:
   * - https://yonodmc.in
   * - https://www.yonodmc.in
   * - http://localhost:3000
   */
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  applyGoogleStateCookie(response, state);
  applyGoogleNextPathCookie(response, nextPath);
  return response;
}
