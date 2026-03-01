import crypto from "node:crypto";
import { NextResponse } from "next/server";

type CookieStoreLike = {
  get(name: string): { value: string } | undefined;
};

export type CustomerPhoneOtpProvider = "supabase_phone" | "twilio_verify";

export interface CustomerPhoneVerifyContext {
  userId: string;
  phone: string;
  provider: CustomerPhoneOtpProvider;
  exp: number;
}

export const CUSTOMER_PHONE_VERIFY_COOKIE_NAME = "yono_customer_phone_verify";

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

function encodeSignedPayload<T extends object>(payload: T): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decodeSignedPayload<T extends object>(value: string): T | null {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function setCustomerPhoneVerifyCookie(
  response: NextResponse,
  context: Omit<CustomerPhoneVerifyContext, "exp">
): void {
  const payload: CustomerPhoneVerifyContext = {
    ...context,
    exp: Date.now() + 10 * 60 * 1000,
  };
  response.cookies.set(CUSTOMER_PHONE_VERIFY_COOKIE_NAME, encodeSignedPayload(payload), {
    ...cookieBaseOptions(60 * 10),
  });
}

export function clearCustomerPhoneVerifyCookie(response: NextResponse): void {
  response.cookies.set(CUSTOMER_PHONE_VERIFY_COOKIE_NAME, "", {
    ...cookieBaseOptions(0),
  });
}

export function readCustomerPhoneVerifyFromRequest(
  req: Request
): CustomerPhoneVerifyContext | null {
  const token = parseCookieHeader(req, CUSTOMER_PHONE_VERIFY_COOKIE_NAME);
  if (!token) return null;
  const payload = decodeSignedPayload<CustomerPhoneVerifyContext>(token);
  if (!payload || !payload.userId || !payload.phone || !payload.provider || !payload.exp) return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export function readCustomerPhoneVerifyFromCookieStore(
  cookieStore: CookieStoreLike
): CustomerPhoneVerifyContext | null {
  const token = cookieStore.get(CUSTOMER_PHONE_VERIFY_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decodeSignedPayload<CustomerPhoneVerifyContext>(token);
  if (!payload || !payload.userId || !payload.phone || !payload.provider || !payload.exp) return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}
