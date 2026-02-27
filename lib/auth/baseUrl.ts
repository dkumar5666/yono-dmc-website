function normalizeBaseUrl(value: string): string {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) return "";

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return "";
  }
}

function firstHeaderValue(value: string | null): string {
  if (!value) return "";
  return value
    .split(",")
    .map((part) => part.trim())
    .find(Boolean) ?? "";
}

export function getPublicBaseUrl(req: Request): string {
  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();

  if (envBase) {
    const normalizedEnv = normalizeBaseUrl(envBase);
    if (normalizedEnv) return normalizedEnv;
  }

  const proto = firstHeaderValue(req.headers.get("x-forwarded-proto")) || "https";
  const host =
    firstHeaderValue(req.headers.get("x-forwarded-host")) ||
    firstHeaderValue(req.headers.get("host"));

  if (host) {
    return `${proto}://${host}`;
  }

  const origin = normalizeBaseUrl(new URL(req.url).origin);
  return origin || "https://www.yonodmc.in";
}
