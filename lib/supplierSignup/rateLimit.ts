import "server-only";

import { checkBestEffortRateLimit } from "@/lib/security/bestEffortRateLimit";

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
