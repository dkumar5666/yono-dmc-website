import "server-only";

interface Bucket {
  hits: number[];
}

interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds: number;
}

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

function getStore(): Map<string, Bucket> {
  const g = globalThis as typeof globalThis & { __bestEffortRateLimitStore?: Map<string, Bucket> };
  if (!g.__bestEffortRateLimitStore) {
    g.__bestEffortRateLimitStore = new Map<string, Bucket>();
  }
  return g.__bestEffortRateLimitStore;
}

export function checkBestEffortRateLimit(
  namespace: string,
  rawKey: string | null | undefined,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const key = `${namespace}:${(rawKey ?? "unknown").trim() || "unknown"}`;
  const store = getStore();
  const bucket = store.get(key) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((ts) => now - ts < options.windowMs);
  if (bucket.hits.length >= options.maxRequests) {
    store.set(key, bucket);
    const oldest = bucket.hits[0] ?? now;
    const retryMs = Math.max(1, options.windowMs - (now - oldest));
    return { limited: true, retryAfterSeconds: Math.ceil(retryMs / 1000) };
  }

  bucket.hits.push(now);
  store.set(key, bucket);
  return { limited: false, retryAfterSeconds: 0 };
}

