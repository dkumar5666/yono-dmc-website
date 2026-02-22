type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const memoryStore = new Map<string, RateLimitEntry>();

function nowMs(): number {
  return Date.now();
}

function cleanupExpired(now: number) {
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp?.trim()) return cfIp.trim();
  return "unknown";
}

export function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = nowMs();
  cleanupExpired(now);

  const current = memoryStore.get(key);
  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      ok: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  const nextCount = current.count + 1;
  current.count = nextCount;
  memoryStore.set(key, current);

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  if (nextCount > maxRequests) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, maxRequests - nextCount),
    retryAfterSeconds,
  };
}
