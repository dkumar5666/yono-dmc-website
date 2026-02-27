import { getAmadeusConfig } from "@/lib/config/amadeus";

interface AmadeusTokenResponse {
  access_token?: string;
  expires_in?: number;
}

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function baseUrl(): string {
  return getAmadeusConfig().baseUrl;
}

function getCredentials() {
  const { clientId, clientSecret } = getAmadeusConfig();
  return { clientId, clientSecret };
}

async function fetchToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = getCredentials();
  const tokenEndpoint = `${baseUrl()}/v1/security/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amadeus auth failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as AmadeusTokenResponse;
  if (!json.access_token || !json.expires_in) {
    throw new Error("Invalid Amadeus auth response");
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + Math.max((json.expires_in - 60) * 1000, 30_000),
  };

  return tokenCache.accessToken;
}

function toQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const str = query.toString();
  return str ? `?${str}` : "";
}

export async function amadeusGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const token = await fetchToken();
  const url = `${baseUrl()}${path}${toQuery(params)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amadeus GET ${path} failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}
