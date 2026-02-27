import { NextResponse } from "next/server";
import {
  applyCustomerSessionCookie,
  clearGoogleNextPathCookie,
  clearGoogleStateCookie,
  createCustomerSessionToken,
  readGoogleNextPathFromRequest,
  readGoogleStateFromRequest,
} from "@/lib/backend/customerAuth";
import { getPublicBaseUrl } from "@/lib/auth/baseUrl";
import { upsertCustomer } from "@/lib/backend/customerStore";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleUserInfo {
  sub?: string;
  name?: string;
  email?: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readGoogleStateFromRequest(req);
  const nextPath = readGoogleNextPathFromRequest(req);
  const baseUrl = getPublicBaseUrl(req);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: "Google OAuth not configured: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET",
      },
      { status: 500 }
    );
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
    return NextResponse.redirect(`${baseUrl}/login?error=google_token`);
  }

  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenJson.access_token) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_token`);
  }

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    cache: "no-store",
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_userinfo`);
  }

  const user = (await userRes.json()) as GoogleUserInfo;
  if (!user.sub || !user.name) {
    return NextResponse.redirect(`${baseUrl}/login?error=google_profile`);
  }

  try {
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
    if (process.env.NODE_ENV !== "production") {
      console.error("[google-oauth] callback persistence failed", error);
    }
    return NextResponse.redirect(`${baseUrl}/login?error=google_persist`);
  }
}
