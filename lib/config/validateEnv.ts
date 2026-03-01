import "server-only";

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

function read(name: string): string {
  return process.env[name]?.trim() || "";
}

function has(name: string): boolean {
  return Boolean(read(name));
}

function pushMissing(target: string[], ...names: string[]) {
  for (const name of names) {
    if (!target.includes(name)) target.push(name);
  }
}

function pushWarning(target: string[], message: string) {
  if (!target.includes(message)) target.push(message);
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Core
  if (!has("NEXT_PUBLIC_SUPABASE_URL")) pushMissing(missing, "NEXT_PUBLIC_SUPABASE_URL");
  if (!has("NEXT_PUBLIC_SUPABASE_ANON_KEY")) pushMissing(missing, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!has("SUPABASE_SERVICE_ROLE_KEY")) pushMissing(missing, "SUPABASE_SERVICE_ROLE_KEY");
  if (!has("SITE_URL")) pushMissing(missing, "SITE_URL");

  // Auth (either Supabase public auth config OR legacy Google client config)
  const supabasePublicAuthReady = has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const googleLegacyReady = has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET");
  if (!supabasePublicAuthReady && !googleLegacyReady) {
    pushMissing(
      missing,
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET"
    );
    pushWarning(
      warnings,
      "Auth is not fully configured. Set Supabase public auth keys (recommended) or legacy Google OAuth credentials."
    );
  }
  if (!has("AUTH_SESSION_SECRET") && !has("NEXTAUTH_SECRET")) {
    pushWarning(warnings, "Set AUTH_SESSION_SECRET (or NEXTAUTH_SECRET) for stable signed session cookies.");
  }

  // OTP (Supabase phone auth is primary; Twilio is fallback)
  const twilioReady =
    has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN") && has("TWILIO_VERIFY_SERVICE_SID");
  if (!supabasePublicAuthReady && !twilioReady) {
    pushWarning(
      warnings,
      "OTP may fail: neither Supabase public auth keys nor Twilio Verify credentials are fully configured."
    );
  } else if (!twilioReady) {
    pushWarning(
      warnings,
      "Twilio Verify fallback is not configured. OTP relies on Supabase Phone Auth only."
    );
  }

  // Payments
  if (!has("RAZORPAY_KEY_ID")) pushMissing(missing, "RAZORPAY_KEY_ID");
  if (!has("RAZORPAY_KEY_SECRET")) pushMissing(missing, "RAZORPAY_KEY_SECRET");
  if (!has("RAZORPAY_WEBHOOK_SECRET")) pushMissing(missing, "RAZORPAY_WEBHOOK_SECRET");

  // Internal
  if (!has("INTERNAL_CRON_KEY")) pushMissing(missing, "INTERNAL_CRON_KEY");
  if (!has("APP_MODE")) pushWarning(warnings, "Set APP_MODE to staging or production for release-safe behavior.");

  // Supplier (Amadeus)
  if (!has("AMADEUS_CLIENT_ID")) pushMissing(missing, "AMADEUS_CLIENT_ID");
  if (!has("AMADEUS_CLIENT_SECRET")) pushMissing(missing, "AMADEUS_CLIENT_SECRET");
  if (!has("AMADEUS_BASE_URL")) pushMissing(missing, "AMADEUS_BASE_URL");
  if (!has("AMADEUS_ENV")) pushMissing(missing, "AMADEUS_ENV");

  if (has("AMADEUS_BASE_URL")) {
    try {
      // Validate URL format only (never emit value in output).
      new URL(read("AMADEUS_BASE_URL"));
    } catch {
      pushWarning(warnings, "AMADEUS_BASE_URL is present but not a valid URL.");
    }
  }

  if (has("SITE_URL")) {
    try {
      const value = read("SITE_URL");
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
        pushWarning(warnings, "SITE_URL should use https in production.");
      }
    } catch {
      pushWarning(warnings, "SITE_URL is present but not a valid URL.");
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}
