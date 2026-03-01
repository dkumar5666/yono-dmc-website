import "server-only";

export type AppMode = "staging" | "production";

function safeString(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function getAppMode(): AppMode {
  const raw = safeString(process.env.APP_MODE);
  if (raw === "staging") return "staging";
  return "production";
}

export function isStagingMode(): boolean {
  return getAppMode() === "staging";
}

export function isSupplierBookingAllowedInStaging(): boolean {
  const override = safeString(process.env.STAGING_ALLOW_SUPPLIER_BOOKING);
  return override === "1" || override === "true" || override === "yes";
}

