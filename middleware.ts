import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CANONICAL_HOST = "www.yonodmc.in";
const NON_CANONICAL_HOST = "yonodmc.in";

function extractHost(hostHeader: string | null): string {
  if (!hostHeader) return "";
  return hostHeader.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

function resolveCanonicalHost(): string {
  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) return DEFAULT_CANONICAL_HOST;
  try {
    const parsed = new URL(siteUrl);
    return parsed.host.toLowerCase();
  } catch {
    return DEFAULT_CANONICAL_HOST;
  }
}

export function middleware(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id")?.trim().slice(0, 64) || globalThis.crypto.randomUUID().slice(0, 12);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-yono-pathname", req.nextUrl.pathname);
  requestHeaders.set("x-request-id", requestId);

  const incomingHost = extractHost(
    req.headers.get("x-forwarded-host") || req.headers.get("host")
  );
  const canonicalHost = resolveCanonicalHost();

  if (!incomingHost || incomingHost === canonicalHost) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (incomingHost !== NON_CANONICAL_HOST) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.host = canonicalHost;

  // Use 308 to preserve method/body for API calls while enforcing canonical host.
  const response = NextResponse.redirect(url, 308);
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/:path*"],
};
