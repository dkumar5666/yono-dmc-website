import { apiError, apiSuccess } from "@/lib/backend/http";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";
import {
  checkOtpSendGuards,
  getOtpPolicy,
  logOtpRequest,
  markOtpSent,
  normalizePhoneE164,
} from "@/lib/auth/otpAbuse";
import {
  sendEmailOtp,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import {
  isTwilioVerifyConfigured,
  sendOtpWithTwilio,
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
} from "@/lib/auth/twilioVerifyFallback";
import {
  createFlowSessionId,
  readCustomerSignupFlowContext,
  setCustomerSignupFlowContext,
} from "@/lib/auth/customerAuthFlowContext";
import {
  getCustomerAuthStateByEmail,
  getCustomerAuthStateByPhone,
  isExistingCustomerAccount,
} from "@/lib/auth/customerAuthState";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface SignupStartBody {
  email?: string;
  phone?: string;
  country?: string;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeUserAgent(req: Request): string {
  return (req.headers.get("user-agent") || "").slice(0, 240);
}

async function sendPhoneOtpWithFallback(phone: string): Promise<"twilio_verify"> {
  if (!isTwilioVerifyConfigured()) {
    throw new TwilioVerifyUnavailableError("Twilio Verify is not configured.");
  }
  await sendOtpWithTwilio(phone);
  return "twilio_verify";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const userAgent = safeUserAgent(req);

  try {
    const body = (await req.json().catch(() => ({}))) as SignupStartBody;
    const email = normalizeEmail(body.email);
    const phone = normalizePhoneE164(body.phone || "", body.country || "IN");
    const policy = getOtpPolicy();

    safeLog(
      "auth.customer.signup.start.requested",
      {
        requestId,
        route: "/api/customer-auth/signup/start",
        hasEmail: Boolean(email),
        hasPhone: Boolean(phone),
      },
      req
    );

    if (!email) {
      return apiError(req, 400, "MISSING_EMAIL", "Email is required.");
    }
    if (!isValidEmail(email)) {
      return apiError(req, 400, "INVALID_EMAIL", "Enter a valid email address.");
    }
    if (!phone) {
      return apiError(req, 400, "INVALID_PHONE", "Enter a valid mobile number.");
    }

    const emailRate = consumeRateLimit(
      `customer-signup-email:${email}`,
      policy.perPhonePerHour,
      60 * 60 * 1000
    );
    if (!emailRate.ok) {
      return apiError(req, 429, "RATE_LIMITED", "Too many OTP requests. Please try again later.", {
        retryAfter: emailRate.retryAfterSeconds,
      });
    }

    const ipRate = consumeRateLimit(
      `customer-signup-email-ip:${ip}`,
      policy.perIpPerHour,
      60 * 60 * 1000
    );
    if (!ipRate.ok) {
      return apiError(req, 429, "RATE_LIMITED", "Too many OTP requests. Please try again later.", {
        retryAfter: ipRate.retryAfterSeconds,
      });
    }

    const phoneGuard = await checkOtpSendGuards({
      phoneE164: phone,
      ip,
      policy,
    });
    if (!phoneGuard.ok) {
      await logOtpRequest({
        phoneE164: phone,
        ip,
        userAgent,
        status: "blocked",
        meta: { code: "RATE_LIMITED", retryAfter: phoneGuard.retryAfter, source: "customer_signup_start" },
      });
      const response = apiError(
        req,
        429,
        "RATE_LIMITED",
        "Too many OTP requests. Please try again later.",
        { retryAfter: phoneGuard.retryAfter }
      );
      response.headers.set("retry-after", String(phoneGuard.retryAfter));
      return response;
    }

    const existingEmail = await getCustomerAuthStateByEmail(email);
    if (isExistingCustomerAccount(existingEmail)) {
      return apiError(
        req,
        409,
        "ACCOUNT_EXISTS",
        "Account already exists. Please sign in."
      );
    }
    if (existingEmail && existingEmail.role !== "customer") {
      return apiError(
        req,
        409,
        "ACCOUNT_EXISTS",
        "This email is already linked with another portal."
      );
    }

    const existingPhone = await getCustomerAuthStateByPhone(phone);
    if (isExistingCustomerAccount(existingPhone)) {
      return apiError(
        req,
        409,
        "ACCOUNT_EXISTS",
        "Account already exists. Please sign in."
      );
    }
    if (existingPhone && existingPhone.role !== "customer") {
      return apiError(
        req,
        409,
        "ACCOUNT_EXISTS",
        "This mobile number is already linked with another portal."
      );
    }
    if (
      existingEmail &&
      existingPhone &&
      existingEmail.userId !== existingPhone.userId &&
      (Boolean(existingEmail.emailVerifiedAt) || Boolean(existingPhone.phoneVerifiedAt))
    ) {
      return apiError(
        req,
        409,
        "ACCOUNT_CONFLICT",
        "Email and mobile belong to different accounts. Please sign in and recover access."
      );
    }

    await sendEmailOtp({ email });
    const mobileProvider = await sendPhoneOtpWithFallback(phone);
    await markOtpSent(phone);
    await logOtpRequest({
      phoneE164: phone,
      ip,
      userAgent,
      status: "sent",
      meta: { source: "customer_signup_start", provider: mobileProvider },
    });

    const previousContext = readCustomerSignupFlowContext(req);
    const sessionId =
      previousContext &&
      previousContext.email.toLowerCase() === email &&
      previousContext.phone === phone
        ? previousContext.sessionId
        : createFlowSessionId();

    const response = apiSuccess(req, {
      signup_session_id: sessionId,
      email_sent: true,
      phone_sent: true,
      cooldownSeconds: policy.cooldownSeconds,
    });
    setCustomerSignupFlowContext(response, {
      sessionId,
      email,
      phone,
      userId: existingEmail?.userId || existingPhone?.userId || undefined,
      emailVerified: false,
      phoneVerified: false,
    });

    safeLog(
      "auth.customer.signup.start.success",
      {
        requestId,
        route: "/api/customer-auth/signup/start",
        provider: mobileProvider,
      },
      req
    );

    return response;
  } catch (error) {
    safeLog(
      "auth.customer.signup.start.failed",
      {
        requestId,
        route: "/api/customer-auth/signup/start",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "otp_send_failed"
              : error instanceof TwilioVerifyUnavailableError
                ? "twilio_verify_unavailable"
                : error instanceof TwilioVerifyRequestError
                  ? error.code || "otp_send_failed"
                  : "otp_send_failed",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError || error instanceof TwilioVerifyUnavailableError) {
      return apiError(
        req,
        503,
        "OTP_PROVIDER_UNAVAILABLE",
        "OTP service temporarily unavailable, please retry in 2 minutes."
      );
    }
    if (error instanceof SupabaseAuthRequestError || error instanceof TwilioVerifyRequestError) {
      const status = error.status === 429 ? 429 : error.status >= 500 ? 502 : 400;
      return apiError(
        req,
        status,
        status === 429 ? "RATE_LIMITED" : "OTP_SEND_FAILED",
        status === 429
          ? "Too many OTP requests. Please try again later."
          : "Failed to send verification OTP."
      );
    }

    return apiError(req, 500, "SIGNUP_START_FAILED", "Failed to start signup.");
  }
}
