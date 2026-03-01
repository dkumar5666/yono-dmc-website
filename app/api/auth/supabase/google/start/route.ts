import { NextResponse } from "next/server";
import { getPublicBaseUrl } from "@/lib/auth/baseUrl";
import { getSupabasePublicAuthConfig } from "@/lib/auth/supabaseConfig";
import {
  applyOAuthContextCookie,
  createPkcePair,
  normalizeRole,
  sanitizeNextPath,
} from "@/lib/auth/supabaseSession";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

function shortText(value: string | null, max = 120): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const requestUrl = new URL(req.url);
  const config = getSupabasePublicAuthConfig();
  const baseUrl = getPublicBaseUrl(req);

  safeLog(
    "auth.supabase.google.start.requested",
    {
      requestId,
      route: "/api/auth/supabase/google/start",
    },
    req
  );

  if (!config) {
    safeLog(
      "auth.supabase.google.start.failed",
      {
        requestId,
        route: "/api/auth/supabase/google/start",
        outcome: "fail",
        reason: "supabase_auth_not_configured",
      },
      req
    );
    return NextResponse.redirect(`${baseUrl}/login?error=supabase_auth_not_configured`);
  }

  const role = normalizeRole(requestUrl.searchParams.get("role"));
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const fullName = shortText(requestUrl.searchParams.get("full_name"), 120);
  const companyName = shortText(requestUrl.searchParams.get("company_name"), 160);
  const governmentId = shortText(requestUrl.searchParams.get("government_id"), 120);
  const taxId = shortText(requestUrl.searchParams.get("tax_id"), 120);
  const officeAddress = shortText(requestUrl.searchParams.get("office_address"), 250);
  const city = shortText(requestUrl.searchParams.get("city"), 80);

  const pkce = createPkcePair();
  const redirectUri = `${baseUrl}/auth/callback`;
  const authorizeUrl = new URL(`${config.url}/auth/v1/authorize`);
  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", redirectUri);
  authorizeUrl.searchParams.set("code_challenge", pkce.challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "s256");

  const response = NextResponse.redirect(authorizeUrl);
  response.headers.set("x-request-id", requestId);
  applyOAuthContextCookie(response, {
    verifier: pkce.verifier,
    nextPath,
    role,
    fullName,
    companyName,
    governmentId,
    taxId,
    officeAddress,
    city,
  });

  safeLog(
    "auth.supabase.google.start.success",
    {
      requestId,
      route: "/api/auth/supabase/google/start",
      outcome: "success",
      hasRoleHint: Boolean(role),
    },
    req
  );

  return response;
}
