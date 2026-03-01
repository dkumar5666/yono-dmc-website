import "server-only";

function safeString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function configuredInternalKeys(): string[] {
  const keys = [
    safeString(process.env.INTERNAL_CRON_KEY),
    safeString(process.env.CRM_AUTOMATION_SECRET),
  ].filter(Boolean);
  return Array.from(new Set(keys));
}

export function isAuthorizedInternalRequest(req: Request): boolean {
  const keys = configuredInternalKeys();
  if (keys.length === 0) return false;

  const headerKey = safeString(req.headers.get("x-internal-key"));
  const queryKey = safeString(new URL(req.url).searchParams.get("key"));

  return keys.includes(headerKey) || keys.includes(queryKey);
}

