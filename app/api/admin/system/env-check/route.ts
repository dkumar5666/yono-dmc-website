import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { validateEnv } from "@/lib/config/validateEnv";
import { getAppMode } from "@/lib/config/appMode";

type IntegrationMode = "production" | "staging" | "test" | "sandbox" | "configured" | "missing";

interface EnvCheckResponse {
  ok: boolean;
  missing: string[];
  warnings: string[];
  modes: {
    app: IntegrationMode;
    razorpay: IntegrationMode;
    amadeus: IntegrationMode;
    otp: IntegrationMode;
    googleOAuth: IntegrationMode;
    whatsappWebhook: IntegrationMode;
  };
}

function safeString(value: string | undefined): string {
  return (value ?? "").trim();
}

function has(name: string): boolean {
  return Boolean(safeString(process.env[name]));
}

function detectRazorpayMode(): IntegrationMode {
  const keyId = safeString(process.env.RAZORPAY_KEY_ID);
  if (!keyId) return "missing";
  if (keyId.startsWith("rzp_test_")) return "test";
  return "production";
}

function detectAmadeusMode(): IntegrationMode {
  const env = safeString(process.env.AMADEUS_ENV).toLowerCase();
  const baseUrl = safeString(process.env.AMADEUS_BASE_URL).toLowerCase();
  if (!env && !baseUrl) return "missing";
  if (env.includes("test") || baseUrl.includes("test.api.amadeus.com")) return "test";
  return "production";
}

function detectOtpMode(): IntegrationMode {
  const twilioReady = has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN") && has("TWILIO_VERIFY_SERVICE_SID");
  const supabaseReady = has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (twilioReady) return "configured";
  if (supabaseReady) return "configured";
  return "missing";
}

function detectGoogleMode(): IntegrationMode {
  return has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET") ? "configured" : "missing";
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  const result = validateEnv();
  const payload: EnvCheckResponse = {
    ...result,
    modes: {
      app: getAppMode(),
      razorpay: detectRazorpayMode(),
      amadeus: detectAmadeusMode(),
      otp: detectOtpMode(),
      googleOAuth: detectGoogleMode(),
      whatsappWebhook: has("WHATSAPP_WEBHOOK_KEY") ? "configured" : "missing",
    },
  };

  return NextResponse.json(payload);
}
