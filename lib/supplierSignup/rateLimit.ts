import "server-only";

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateBucket>();

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return forwardedFor;
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

interface RateLimitConfig {
  namespace: string;
  maxRequests: number;
  windowMs: number;
}

function checkBestEffortRateLimit(
  namespace: string,
  key: string,
  opts: { maxRequests: number; windowMs: number }
): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucketKey = `${namespace}:${key}`;
  const existing = rateLimitStore.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(bucketKey, {
      count: 1,
      resetAt: now + opts.windowMs,
    });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  rateLimitStore.set(bucketKey, existing);
  if (existing.count <= opts.maxRequests) {
    return { limited: false, retryAfterSeconds: 0 };
  }

  const retryAfterMs = Math.max(0, existing.resetAt - now);
  return { limited: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

export function checkSupplierSignupRateLimit(
  req: Request,
  config: RateLimitConfig
): { limited: boolean; retryAfterSeconds: number; ip: string } {
  const ip = getClientIp(req);
  const result = checkBestEffortRateLimit(config.namespace, ip, {
    maxRequests: config.maxRequests,
    windowMs: config.windowMs,
  });
  return {
    limited: result.limited,
    retryAfterSeconds: result.retryAfterSeconds,
    ip,
  };
}
