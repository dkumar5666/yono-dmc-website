import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const SUPPLIER_SIGNUP_CONTEXT_COOKIE = "yono_supplier_signup_ctx";

type OtpProvider = "supabase_email" | "twilio_verify_email" | "supabase_phone" | "twilio_verify";

export interface SupplierSignupOtpContext {
  email: string;
  phone: string;
  emailOtpProvider?: OtpProvider;
  phoneOtpProvider?: OtpProvider;
  emailVerified: boolean;
  phoneVerified: boolean;
  exp: number;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

export function readSupplierSignupContextFromRequest(req: Request): SupplierSignupOtpContext | null {
  const token = parseCookieHeader(req, SUPPLIER_SIGNUP_CONTEXT_COOKIE);
  if (!token) return null;
  const payload = decodeSignedPayload<SupplierSignupOtpContext>(token);
  if (!payload) return null;
  if (!safeString(payload.email) || !safeString(payload.phone)) return null;
  if (typeof payload.emailVerified !== "boolean" || typeof payload.phoneVerified !== "boolean") return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}

export function setSupplierSignupContextCookie(
  response: NextResponse,
  payload: Omit<SupplierSignupOtpContext, "exp">,
  ttlSeconds = 15 * 60
): void {
  const signed = encodeSignedPayload<SupplierSignupOtpContext>({
    ...payload,
    exp: Date.now() + ttlSeconds * 1000,
  });
  response.cookies.set(SUPPLIER_SIGNUP_CONTEXT_COOKIE, signed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlSeconds,
  });
}

export function clearSupplierSignupContextCookie(response: NextResponse): void {
  response.cookies.set(SUPPLIER_SIGNUP_CONTEXT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

