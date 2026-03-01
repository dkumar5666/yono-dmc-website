import { apiError, apiSuccess } from "@/lib/backend/http";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";
import { getOtpPolicy } from "@/lib/auth/otpAbuse";
import {
  sendEmailOtp,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import {
  createFlowSessionId,
  readCustomerEmailLoginFlowContext,
  setCustomerEmailLoginFlowContext,
} from "@/lib/auth/customerAuthFlowContext";
import { getCustomerAuthStateByEmail } from "@/lib/auth/customerAuthState";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface EmailOtpStartBody {
  email?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const ip = getClientIp(req);

  try {
    const body = (await req.json().catch(() => ({}))) as EmailOtpStartBody;
    const email = safeString(body.email).toLowerCase();
    const policy = getOtpPolicy();

    safeLog(
      "auth.customer.login.email_otp.start.requested",
      {
        requestId,
        route: "/api/customer-auth/login/email-otp/start",
        hasEmail: Boolean(email),
      },
      req
    );

    if (!email) {
      return apiError(req, 400, "MISSING_EMAIL", "Email is required.");
    }
    if (!isValidEmail(email)) {
      return apiError(req, 400, "INVALID_EMAIL", "Enter a valid email address.");
    }

    const state = await getCustomerAuthStateByEmail(email);
    if (!state || state.role !== "customer") {
      return apiError(req, 404, "NOT_FOUND", "Account not found. Please create account first.");
    }
    const hasCredential = Boolean(state.passwordSetAt) || state.authProvider === "google" || state.profileCompleted;
    const fullyVerified = Boolean(state.emailVerifiedAt) && Boolean(state.phoneVerifiedAt);
    if (!fullyVerified || !hasCredential) {
      return apiError(
        req,
        409,
        "SIGNUP_INCOMPLETE",
        "Please complete account signup before using login."
      );
    }

    const emailRate = consumeRateLimit(
      `customer-login-email-otp:${email}`,
      policy.perPhonePerHour,
      60 * 60 * 1000
    );
    if (!emailRate.ok) {
      return apiError(req, 429, "RATE_LIMITED", "Too many OTP requests. Please try again later.", {
        retryAfter: emailRate.retryAfterSeconds,
      });
    }

    const ipRate = consumeRateLimit(
      `customer-login-email-otp-ip:${ip}`,
      policy.perIpPerHour,
      60 * 60 * 1000
    );
    if (!ipRate.ok) {
      return apiError(req, 429, "RATE_LIMITED", "Too many OTP requests. Please try again later.", {
        retryAfter: ipRate.retryAfterSeconds,
      });
    }

    await sendEmailOtp({ email });

    const previous = readCustomerEmailLoginFlowContext(req);
    const sessionId =
      previous && previous.email.toLowerCase() === email ? previous.sessionId : createFlowSessionId();

    const response = apiSuccess(req, {
      ok: true,
      login_session_id: sessionId,
      cooldownSeconds: policy.cooldownSeconds,
    });
    setCustomerEmailLoginFlowContext(response, {
      sessionId,
      email,
    });

    safeLog(
      "auth.customer.login.email_otp.start.success",
      {
        requestId,
        route: "/api/customer-auth/login/email-otp/start",
      },
      req
    );
    return response;
  } catch (error) {
    safeLog(
      "auth.customer.login.email_otp.start.failed",
      {
        requestId,
        route: "/api/customer-auth/login/email-otp/start",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "otp_send_failed"
              : "otp_send_failed",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(
        req,
        503,
        "OTP_PROVIDER_UNAVAILABLE",
        "OTP service temporarily unavailable, please retry in 2 minutes."
      );
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "OTP_SEND_FAILED",
        "Failed to send email OTP."
      );
    }
    return apiError(req, 500, "OTP_SEND_FAILED", "Failed to send email OTP.");
  }
}
