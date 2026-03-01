import "server-only";

import { getAmadeusConfig } from "@/lib/config/amadeus";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface AmadeusFetchParams {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
}

interface TokenCacheState {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCacheState | null = null;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toQueryString(
  query?: Record<string, string | number | boolean | null | undefined>
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function makeAbortController(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function fetchToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  const { baseUrl, clientId, clientSecret } = getAmadeusConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const { controller, timeout } = makeAbortController(10_000);
  try {
    const response = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const status = response.status;
      throw new Error(`AMADEUS_AUTH_FAILED_${status}`);
    }

    const json = (await response.json().catch(() => ({}))) as TokenResponse;
    const token = safeString(json.access_token);
    const expiresIn = Number(json.expires_in ?? 0);
    if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error("AMADEUS_AUTH_INVALID_RESPONSE");
    }

    tokenCache = {
      accessToken: token,
      expiresAt: Date.now() + Math.max((expiresIn - 60) * 1000, 30_000),
    };
    return token;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAccessToken(): Promise<string> {
  return fetchToken(false);
}

export async function amadeusFetch<T>(
  path: string,
  params?: AmadeusFetchParams
): Promise<T> {
  const config = getAmadeusConfig();
  const method: HttpMethod = params?.method ?? "GET";
  const queryString = toQueryString(params?.query);
  const url = `${config.baseUrl}${path}${queryString}`;
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(params?.headers ?? {}),
  };

  const run = async (forceRefreshToken = false) => {
    const accessToken = await fetchToken(forceRefreshToken);
    const headers = {
      ...baseHeaders,
      Authorization: `Bearer ${accessToken}`,
    };
    const { controller, timeout } = makeAbortController(10_000);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: params?.body !== undefined ? JSON.stringify(params.body) : undefined,
        cache: "no-store",
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await run(false);
  if (response.status === 401) {
    tokenCache = null;
    response = await run(true);
  }

  if (!response.ok) {
    const status = response.status;
    const text = await response.text().catch(() => "");
    const snippet = safeString(text).slice(0, 500);
    throw new Error(`AMADEUS_HTTP_${status}:${snippet || "request_failed"}`);
  }

  return (await response.json().catch(() => ({}))) as T;
}

