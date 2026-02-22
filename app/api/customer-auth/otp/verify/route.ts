import {
  applyCustomerSessionCookie,
  createCustomerSessionToken,
} from "@/lib/backend/customerAuth";
import { upsertCustomer } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { logError } from "@/lib/backend/logger";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";
import {
  checkOtpVerifyAllowed,
  markOtpVerifyFailure,
  markOtpVerifySuccess,
} from "@/lib/backend/otpGuard";

const TWILIO_VERIFY_API_BASE = "https://verify.twilio.com/v2";

interface VerifyOtpBody {
  mobile?: string;
  code?: string;
  name?: string;
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
    const ip = getClientIp(req);
    const ipLimit = consumeRateLimit(`otp-verify-ip:${ip}`, 30, 15 * 60 * 1000);
    if (!ipLimit.ok) {
      const response = apiError(
        req,
        429,
        "RATE_LIMITED",
        "Too many OTP verification attempts. Try again later.",
        { retryAfterSeconds: ipLimit.retryAfterSeconds }
      );
      response.headers.set("retry-after", String(ipLimit.retryAfterSeconds));
      return response;
    }

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

    const body = (await req.json()) as VerifyOtpBody;
    const to = normalizeMobile(body.mobile ?? "");
    const code = (body.code ?? "").trim();
    const fullName = (body.name ?? "Guest User").trim() || "Guest User";

    if (!to || !code) {
      return apiError(
        req,
        400,
        "OTP_INPUT_REQUIRED",
        "Mobile number and OTP code are required."
      );
    }

    const mobileLimit = consumeRateLimit(`otp-verify-mobile:${to}`, 12, 15 * 60 * 1000);
    if (!mobileLimit.ok) {
      const response = apiError(
        req,
        429,
        "RATE_LIMITED",
        "Too many OTP verification attempts for this number. Try again later.",
        { retryAfterSeconds: mobileLimit.retryAfterSeconds }
      );
      response.headers.set("retry-after", String(mobileLimit.retryAfterSeconds));
      return response;
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

    const customer = upsertCustomer({
      provider: "mobile_otp",
      providerUserId: to,
      phone: to,
      fullName,
    });

    const sessionToken = createCustomerSessionToken({
      id: customer.id,
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      provider: "mobile_otp",
    });

    const response = apiSuccess(req, {
      user: {
        id: customer.id,
        name: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        provider: "mobile_otp",
      },
    });
    applyCustomerSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    logError("OTP VERIFY ERROR", { error });
    return apiError(req, 500, "OTP_VERIFY_ERROR", "Failed to verify OTP.");
  }
}
