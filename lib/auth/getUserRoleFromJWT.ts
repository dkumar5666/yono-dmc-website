import crypto from "node:crypto";

export type AuthRole = "admin" | "staff" | "customer" | "supplier" | "agent";

export interface JwtRoleContext {
  token: string;
  userId: string | null;
  role: AuthRole | null;
  claims: Record<string, unknown>;
  verified: boolean;
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function parseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function safeEqualHex(aHex: string, bBase64Url: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bBase64Url, "base64url");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyHs256(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header64, payload64, signature64] = parts;
  const data = `${header64}.${payload64}`;
  const digest = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return safeEqualHex(digest, signature64);
}

function extractRole(claims: Record<string, unknown>): AuthRole | null {
  const direct = claims.role;
  if (
    direct === "admin" ||
    direct === "staff" ||
    direct === "customer" ||
    direct === "supplier" ||
    direct === "agent"
  ) {
    return direct;
  }

  const userRole = claims.user_role;
  if (
    userRole === "admin" ||
    userRole === "staff" ||
    userRole === "customer" ||
    userRole === "supplier" ||
    userRole === "agent"
  ) {
    return userRole;
  }

  const appMetadata = claims.app_metadata;
  if (appMetadata && typeof appMetadata === "object") {
    const role = (appMetadata as Record<string, unknown>).role;
    if (
      role === "admin" ||
      role === "staff" ||
      role === "customer" ||
      role === "supplier" ||
      role === "agent"
    ) {
      return role;
    }
  }

  return null;
}

export function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/**
 * Decodes role and subject from Supabase JWT.
 * Verifies HS256 signature when SUPABASE_JWT_SECRET is set.
 */
export function getUserRoleFromJWT(token: string): JwtRoleContext {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return {
      token,
      userId: null,
      role: null,
      claims: {},
      verified: false,
    };
  }

  const [header64, payload64] = parts;
  const header = parseJson(decodeBase64Url(header64));
  const claims = parseJson(decodeBase64Url(payload64));

  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  const algorithm = typeof header.alg === "string" ? header.alg.toUpperCase() : "";
  const verified =
    algorithm === "HS256" && secret ? verifyHs256(token, secret) : !secret;

  const subject = typeof claims.sub === "string" ? claims.sub : null;
  return {
    token,
    userId: subject,
    role: extractRole(claims),
    claims,
    verified,
  };
}
