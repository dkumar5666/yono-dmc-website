import { createPasswordResetToken } from "@/lib/backend/passwordReset";
import { getCustomerByPhone } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { logError } from "@/lib/backend/logger";
import {
  checkOtpVerifyAllowed,
  markOtpVerifyFailure,
  markOtpVerifySuccess,
} from "@/lib/backend/otpGuard";

const TWILIO_VERIFY_API_BASE = "https://verify.twilio.com/v2";

interface VerifyForgotPasswordBody {
  mobile?: string;
  code?: string;
}

interface TwilioVerifyCheckResponse {
  status?: string;
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

    const body = (await req.json()) as VerifyForgotPasswordBody;
    const to = normalizeMobile(body.mobile ?? "");
    const code = (body.code ?? "").trim();

    if (!to || !code) {
      return apiError(
        req,
        400,
        "OTP_INPUT_REQUIRED",
        "Mobile number and OTP code are required."
      );
    }

    const verifyAllowed = checkOtpVerifyAllowed(to);
    if (!verifyAllowed.ok) {
      return apiError(
        req,
        429,
        "OTP_TEMP_BLOCKED",
        "Too many failed attempts. Try again later.",
        { retryAfterSeconds: verifyAllowed.retryAfterSeconds }
      );
    }

    const customer = getCustomerByPhone(to);
    if (!customer) {
      return apiError(
        req,
        404,
        "ACCOUNT_NOT_FOUND",
        "No account found for this mobile number."
      );
    }

    const apiUrl = `${TWILIO_VERIFY_API_BASE}/Services/${verifyServiceSid}/VerificationCheck`;
    const payload = new URLSearchParams({ To: to, Code: code });
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
        "OTP_VERIFY_FAILED",
        "OTP verification failed.",
        twilioText
      );
    }

    const verifyResult = (await twilioRes.json()) as TwilioVerifyCheckResponse;
    if (verifyResult.status !== "approved") {
      const failure = markOtpVerifyFailure(to);
      if (failure.blocked) {
        return apiError(
          req,
          429,
          "OTP_TEMP_BLOCKED",
          "Too many failed attempts. Try again later.",
          { retryAfterSeconds: failure.retryAfterSeconds }
        );
      }
      return apiError(req, 401, "OTP_INVALID", "Invalid OTP.", {
        remainingAttempts: failure.remainingAttempts,
      });
    }

    markOtpVerifySuccess(to);

    const resetToken = createPasswordResetToken({
      customerId: customer.id,
      mobile: to,
    });

    return apiSuccess(req, { resetToken, expiresInSeconds: 600 });
  } catch (error) {
    logError("FORGOT PASSWORD OTP VERIFY ERROR", { error });
    return apiError(req, 500, "FORGOT_PASSWORD_VERIFY_ERROR", "Failed to verify OTP.");
  }
}

