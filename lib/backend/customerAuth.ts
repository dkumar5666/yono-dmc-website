import crypto from "node:crypto";
import { NextResponse } from "next/server";

interface CustomerSessionPayload {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  provider: "google" | "mobile_otp";
  exp: number;
}

export const CUSTOMER_AUTH_COOKIE_NAME = "yono_customer_session";
const GOOGLE_STATE_COOKIE_NAME = "yono_google_oauth_state";
const GOOGLE_NEXT_PATH_COOKIE_NAME = "yono_google_oauth_next";

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signingSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "dev-insecure-secret-change-me"
  );
}

function sign(input: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(input).digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function parseCookieHeader(req: Request, key: string): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  for (const entry of cookies) {
    const idx = entry.indexOf("=");
    if (idx < 0) continue;
    const name = entry.slice(0, idx);
    const value = entry.slice(idx + 1);
    if (name === key) return decodeURIComponent(value);
  }
  return null;
}

export function createCustomerSessionToken(input: {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  provider: "google" | "mobile_otp";
}): string {
  const payload: CustomerSessionPayload = {
    ...input,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyCustomerSessionToken(
  token: string
): CustomerSessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as CustomerSessionPayload;
    if (!payload.id || !payload.name || !payload.provider || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCustomerSessionFromRequest(req: Request) {
  const token = parseCookieHeader(req, CUSTOMER_AUTH_COOKIE_NAME);
  if (!token) return null;
  return verifyCustomerSessionToken(token);
}

export function applyCustomerSessionCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set(CUSTOMER_AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearCustomerSessionCookie(response: NextResponse): void {
  response.cookies.set(CUSTOMER_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function createGoogleOauthState(): string {
  return randomToken();
}

export function applyGoogleStateCookie(response: NextResponse, state: string): void {
  response.cookies.set(GOOGLE_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export function readGoogleStateFromRequest(req: Request): string | null {
  return parseCookieHeader(req, GOOGLE_STATE_COOKIE_NAME);
}

export function clearGoogleStateCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function sanitizeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath) return "/";
  if (!nextPath.startsWith("/")) return "/";
  if (nextPath.startsWith("//")) return "/";
  return nextPath;
}

export function applyGoogleNextPathCookie(
  response: NextResponse,
  nextPath: string
): void {
  response.cookies.set(GOOGLE_NEXT_PATH_COOKIE_NAME, sanitizeNextPath(nextPath), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
}

export function readGoogleNextPathFromRequest(req: Request): string {
  const value = parseCookieHeader(req, GOOGLE_NEXT_PATH_COOKIE_NAME);
  return sanitizeNextPath(value);
}

export function clearGoogleNextPathCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_NEXT_PATH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
