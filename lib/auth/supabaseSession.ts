import crypto from "node:crypto";
import { NextResponse } from "next/server";

export type IdentityRole = "customer" | "agent" | "supplier" | "admin";

export interface SupabaseSessionCookiePayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType?: string;
  userId: string;
  email?: string;
  phone?: string;
  fullName?: string;
  role?: IdentityRole;
}

interface OAuthContextPayload {
  verifier: string;
  nextPath: string;
  role?: IdentityRole;
  fullName?: string;
  companyName?: string;
  governmentId?: string;
  taxId?: string;
  officeAddress?: string;
  city?: string;
  exp: number;
}

interface OtpContextPayload {
  phone: string;
  role?: IdentityRole;
  fullName?: string;
  companyName?: string;
  governmentId?: string;
  taxId?: string;
  officeAddress?: string;
  city?: string;
  nextPath: string;
  provider: "supabase_phone" | "twilio_verify";
  challengeId?: string;
  exp: number;
}

type CookieStoreLike = {
  get(name: string): { value: string } | undefined;
};

export const SUPABASE_SESSION_COOKIE_NAME = "yono_supabase_session";
export const SUPABASE_OAUTH_CONTEXT_COOKIE_NAME = "yono_supabase_oauth_context";
export const SUPABASE_OTP_CONTEXT_COOKIE_NAME = "yono_supabase_otp_context";

function normalizeUrlHost(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function resolveCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  const explicit = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (explicit) return explicit;

  const host = normalizeUrlHost(
    process.env.SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      ""
  );
  if (!host || host === "localhost") return undefined;

  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return undefined;
  return `.${parts.slice(-2).join(".")}`;
}

function cookieBaseOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    domain: resolveCookieDomain(),
  };
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signingSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "dev-insecure-secret-change-me"
  );
}

function sign(value: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(value).digest("hex");
}

function parseCookieHeader(req: Request, key: string): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const entries = cookieHeader.split(";").map((part) => part.trim());
  for (const entry of entries) {
    const idx = entry.indexOf("=");
    if (idx < 0) continue;
    const name = entry.slice(0, idx);
    const raw = entry.slice(idx + 1);
    if (name === key) return decodeURIComponent(raw);
  }
  return null;
}

function encodeSignedPayload<T extends object>(payload: T): string {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function decodeSignedPayload<T extends object>(value: string): T | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;

  try {
    return JSON.parse(base64UrlDecode(encoded)) as T;
  } catch {
    return null;
  }
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

export function normalizeRole(value: string | null | undefined): IdentityRole | undefined {
  const role = safeString(value).toLowerCase();
  if (role === "customer" || role === "agent" || role === "supplier" || role === "admin") {
    return role;
  }
  return undefined;
}

export function sanitizeNextPath(path: string | null | undefined): string {
  if (!path) return "/my-trips";
  const value = path.trim();
  if (!value.startsWith("/")) return "/my-trips";
  if (value.startsWith("//")) return "/my-trips";
  if (value.startsWith("/api/")) return "/my-trips";
  return value;
}

export function randomState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function applySupabaseSessionCookie(
  response: NextResponse,
  session: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    expires_at?: number;
    token_type?: string;
  },
  identity: {
    userId: string;
    email?: string;
    phone?: string;
    fullName?: string;
    role?: IdentityRole;
  }
): void {
  const expiresAt =
    typeof session.expires_at === "number"
      ? session.expires_at * 1000
      : Date.now() + Math.max(60, session.expires_in ?? 3600) * 1000;

  const payload: SupabaseSessionCookiePayload = {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt,
    tokenType: session.token_type,
    userId: identity.userId,
    email: identity.email,
    phone: identity.phone,
    fullName: identity.fullName,
    role: identity.role,
  };

  response.cookies.set(SUPABASE_SESSION_COOKIE_NAME, encodeSignedPayload(payload), {
    ...cookieBaseOptions(60 * 60 * 24 * 30),
  });
}

export function clearSupabaseSessionCookie(response: NextResponse): void {
  response.cookies.set(SUPABASE_SESSION_COOKIE_NAME, "", {
    ...cookieBaseOptions(0),
  });
}

function normalizeSessionPayload(
  raw: SupabaseSessionCookiePayload | null
): SupabaseSessionCookiePayload | null {
  if (!raw) return null;
  if (!raw.accessToken || !raw.userId || !raw.expiresAt) return null;
  if (raw.expiresAt <= Date.now() - 60_000) return null;

  const claims = decodeJwtPayload(raw.accessToken);
  const claimSub = safeString(claims.sub);
  if (claimSub && claimSub !== raw.userId) return null;

  return {
    ...raw,
    role: normalizeRole(raw.role) ?? normalizeRole(safeString(claims.role)),
    email: raw.email || safeString(claims.email) || undefined,
    phone: raw.phone || safeString(claims.phone) || undefined,
    fullName:
      raw.fullName ||
      safeString(claims.full_name) ||
      safeString(claims.name) ||
      undefined,
  };
}

export function readSupabaseSessionFromRequest(req: Request): SupabaseSessionCookiePayload | null {
  const token = parseCookieHeader(req, SUPABASE_SESSION_COOKIE_NAME);
  if (!token) return null;
  return normalizeSessionPayload(decodeSignedPayload<SupabaseSessionCookiePayload>(token));
}

export function readSupabaseSessionFromCookieStore(
  cookieStore: CookieStoreLike
): SupabaseSessionCookiePayload | null {
  const token = cookieStore.get(SUPABASE_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return normalizeSessionPayload(decodeSignedPayload<SupabaseSessionCookiePayload>(token));
}

export function applyOAuthContextCookie(
  response: NextResponse,
  context: {
    verifier: string;
    nextPath: string;
    role?: IdentityRole;
    fullName?: string;
    companyName?: string;
    governmentId?: string;
    taxId?: string;
    officeAddress?: string;
    city?: string;
  }
): void {
  const payload: OAuthContextPayload = {
    verifier: context.verifier,
    nextPath: sanitizeNextPath(context.nextPath),
    role: context.role,
    fullName: context.fullName,
    companyName: context.companyName,
    governmentId: context.governmentId,
    taxId: context.taxId,
    officeAddress: context.officeAddress,
    city: context.city,
    exp: Date.now() + 10 * 60 * 1000,
  };

  response.cookies.set(SUPABASE_OAUTH_CONTEXT_COOKIE_NAME, encodeSignedPayload(payload), {
    ...cookieBaseOptions(60 * 10),
  });
}

export function readOAuthContextFromRequest(req: Request): OAuthContextPayload | null {
  const token = parseCookieHeader(req, SUPABASE_OAUTH_CONTEXT_COOKIE_NAME);
  if (!token) return null;
  const payload = decodeSignedPayload<OAuthContextPayload>(token);
  if (!payload || !payload.verifier || !payload.nextPath || !payload.exp) return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export function clearOAuthContextCookie(response: NextResponse): void {
  response.cookies.set(SUPABASE_OAUTH_CONTEXT_COOKIE_NAME, "", {
    ...cookieBaseOptions(0),
  });
}

export function applyOtpContextCookie(
  response: NextResponse,
  context: Omit<OtpContextPayload, "exp">
): void {
  const payload: OtpContextPayload = {
    ...context,
    nextPath: sanitizeNextPath(context.nextPath),
    exp: Date.now() + 10 * 60 * 1000,
  };
  response.cookies.set(SUPABASE_OTP_CONTEXT_COOKIE_NAME, encodeSignedPayload(payload), {
    ...cookieBaseOptions(60 * 10),
  });
}

export function readOtpContextFromRequest(req: Request): OtpContextPayload | null {
  const token = parseCookieHeader(req, SUPABASE_OTP_CONTEXT_COOKIE_NAME);
  if (!token) return null;
  const payload = decodeSignedPayload<OtpContextPayload>(token);
  if (!payload || !payload.phone || !payload.provider || !payload.nextPath || !payload.exp) return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export function clearOtpContextCookie(response: NextResponse): void {
  response.cookies.set(SUPABASE_OTP_CONTEXT_COOKIE_NAME, "", {
    ...cookieBaseOptions(0),
  });
}
