import "server-only";

export interface AmadeusConfig {
  env: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  hostname: string;
}

function readEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

function normalizeBaseUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

function normalizeHostname(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return parsed.host;
}

export function getAmadeusConfig(): AmadeusConfig {
  const env = readEnv("AMADEUS_ENV");
  const baseUrlRaw = readEnv("AMADEUS_BASE_URL");
  const clientId = readEnv("AMADEUS_CLIENT_ID");
  const clientSecret = readEnv("AMADEUS_CLIENT_SECRET");

  const missing: string[] = [];
  if (!env) missing.push("AMADEUS_ENV");
  if (!baseUrlRaw) missing.push("AMADEUS_BASE_URL");
  if (!clientId) missing.push("AMADEUS_CLIENT_ID");
  if (!clientSecret) missing.push("AMADEUS_CLIENT_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }

  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  if (!baseUrl) {
    throw new Error("Invalid env: AMADEUS_BASE_URL");
  }

  const hostname = normalizeHostname(baseUrl);
  return {
    env,
    baseUrl,
    clientId,
    clientSecret,
    hostname,
  };
}
