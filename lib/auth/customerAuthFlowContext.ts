import crypto from "node:crypto";
import { NextResponse } from "next/server";

const CUSTOMER_SIGNUP_FLOW_COOKIE = "yono_customer_signup_flow";
const CUSTOMER_EMAIL_LOGIN_FLOW_COOKIE = "yono_customer_email_login_flow";

export interface CustomerSignupFlowContext {
  sessionId: string;
  email: string;
  phone: string;
  userId?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  exp: number;
}

export interface CustomerEmailLoginFlowContext {
  sessionId: string;
  email: string;
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

function setFlowCookie(response: NextResponse, name: string, value: string, maxAge: number): void {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export function createFlowSessionId(): string {
  return crypto.randomUUID();
}

export function readCustomerSignupFlowContext(req: Request): CustomerSignupFlowContext | null {
  const token = parseCookieHeader(req, CUSTOMER_SIGNUP_FLOW_COOKIE);
  if (!token) return null;
  const payload = decodeSignedPayload<CustomerSignupFlowContext>(token);
  if (!payload) return null;
  if (!safeString(payload.sessionId) || !safeString(payload.email) || !safeString(payload.phone)) return null;
  if (typeof payload.emailVerified !== "boolean" || typeof payload.phoneVerified !== "boolean") return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}

export function setCustomerSignupFlowContext(
  response: NextResponse,
  payload: Omit<CustomerSignupFlowContext, "exp">,
  ttlSeconds = 15 * 60
): void {
  const signed = encodeSignedPayload<CustomerSignupFlowContext>({
    ...payload,
    exp: Date.now() + ttlSeconds * 1000,
  });
  setFlowCookie(response, CUSTOMER_SIGNUP_FLOW_COOKIE, signed, ttlSeconds);
}

export function clearCustomerSignupFlowContext(response: NextResponse): void {
  setFlowCookie(response, CUSTOMER_SIGNUP_FLOW_COOKIE, "", 0);
}

export function readCustomerEmailLoginFlowContext(req: Request): CustomerEmailLoginFlowContext | null {
  const token = parseCookieHeader(req, CUSTOMER_EMAIL_LOGIN_FLOW_COOKIE);
  if (!token) return null;
  const payload = decodeSignedPayload<CustomerEmailLoginFlowContext>(token);
  if (!payload) return null;
  if (!safeString(payload.sessionId) || !safeString(payload.email)) return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return payload;
}

export function setCustomerEmailLoginFlowContext(
  response: NextResponse,
  payload: Omit<CustomerEmailLoginFlowContext, "exp">,
  ttlSeconds = 10 * 60
): void {
  const signed = encodeSignedPayload<CustomerEmailLoginFlowContext>({
    ...payload,
    exp: Date.now() + ttlSeconds * 1000,
  });
  setFlowCookie(response, CUSTOMER_EMAIL_LOGIN_FLOW_COOKIE, signed, ttlSeconds);
}

export function clearCustomerEmailLoginFlowContext(response: NextResponse): void {
  setFlowCookie(response, CUSTOMER_EMAIL_LOGIN_FLOW_COOKIE, "", 0);
}
