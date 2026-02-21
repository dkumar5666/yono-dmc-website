import crypto from "node:crypto";

interface PasswordResetTokenPayload {
  customerId: string;
  mobile: string;
  exp: number;
}

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

export function createPasswordResetToken(input: {
  customerId: string;
  mobile: string;
}): string {
  const payload: PasswordResetTokenPayload = {
    customerId: input.customerId,
    mobile: input.mobile,
    exp: Date.now() + 1000 * 60 * 10,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPasswordResetToken(token: string): PasswordResetTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as PasswordResetTokenPayload;
    if (!payload.customerId || !payload.mobile || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

