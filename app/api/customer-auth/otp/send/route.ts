import { apiError, apiSuccess } from "@/lib/backend/http";
import { logError } from "@/lib/backend/logger";
import { checkOtpSendAllowed, markOtpSent } from "@/lib/backend/otpGuard";

const TWILIO_VERIFY_API_BASE = "https://verify.twilio.com/v2";

interface SendOtpBody {
  mobile?: string;
}

function normalizeMobile(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return `+${digits}`;
}

export async function POST(req: Request) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      return apiError(
        req,
        500,
        "TWILIO_ENV_MISSING",
        "Twilio Verify environment variables are missing."
      );
    }

    const body = (await req.json()) as SendOtpBody;
    const to = normalizeMobile(body.mobile ?? "");
    if (!to) {
      return apiError(
        req,
        400,
        "MOBILE_REQUIRED",
        "Mobile number is required."
      );
    }

    const sendAllowed = checkOtpSendAllowed(to);
    if (!sendAllowed.ok) {
      if (sendAllowed.reason === "blocked") {
        return apiError(
          req,
          429,
          "OTP_TEMP_BLOCKED",
          "Too many failed attempts. Try again later.",
          { retryAfterSeconds: sendAllowed.retryAfterSeconds }
        );
      }
      return apiError(
        req,
        429,
        "OTP_COOLDOWN",
        "Please wait before requesting OTP again.",
        { retryAfterSeconds: sendAllowed.retryAfterSeconds }
      );
    }

    const apiUrl = `${TWILIO_VERIFY_API_BASE}/Services/${verifyServiceSid}/Verifications`;
    const payload = new URLSearchParams({ To: to, Channel: "sms" });
    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const twilioRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cache: "no-store",
    });

    if (!twilioRes.ok) {
      const twilioText = await twilioRes.text();
      return apiError(
        req,
        502,
        "OTP_SEND_FAILED",
        "Failed to send OTP.",
        twilioText
      );
    }

    markOtpSent(to);
    return apiSuccess(req, { sent: true, cooldownSeconds: 45 });
  } catch (error) {
    logError("OTP SEND ERROR", { error });
    return apiError(req, 500, "OTP_SEND_ERROR", "Failed to send OTP.");
  }
}
