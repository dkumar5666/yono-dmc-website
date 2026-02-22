import { NextResponse } from "next/server";
import {
  applyGoogleNextPathCookie,
  applyGoogleStateCookie,
  createGoogleOauthState,
  sanitizeNextPath,
} from "@/lib/backend/customerAuth";
import { apiError } from "@/lib/backend/http";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function appBaseUrl(req: Request): string {
  return process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
}

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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return apiError(
      req,
      500,
      "GOOGLE_ENV_MISSING",
      "GOOGLE_CLIENT_ID is missing in environment."
    );
  }

  const state = createGoogleOauthState();
  const redirectUri = `${appBaseUrl(req)}/api/customer-auth/google/callback`;

  const authUrl = new URL(GOOGLE_AUTH_URL);
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
