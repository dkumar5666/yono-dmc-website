import { NextResponse } from "next/server";
import {
  applyGoogleNextPathCookie,
  applyGoogleStateCookie,
  createGoogleOauthState,
  sanitizeNextPath,
} from "@/lib/backend/customerAuth";
import { apiError } from "@/lib/backend/http";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function appBaseUrl(req: Request): string {
  return process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
}

export async function GET(req: Request) {
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
