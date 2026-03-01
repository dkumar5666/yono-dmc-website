import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  readCustomerSignupFlowContext,
  setCustomerSignupFlowContext,
} from "@/lib/auth/customerAuthFlowContext";
import {
  verifyEmailOtp,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import {
  verifyOtpWithTwilio,
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
} from "@/lib/auth/twilioVerifyFallback";
import { ensureIdentityProfile, getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import { getCustomerAuthStateByPhone, isExistingCustomerAccount } from "@/lib/auth/customerAuthState";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface SignupVerifyBody {
  signup_session_id?: string;
  email_otp?: string;
  phone_otp?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const body = (await req.json().catch(() => ({}))) as SignupVerifyBody;
    const signupSessionId = safeString(body.signup_session_id);
    const emailOtp = safeString(body.email_otp);
    const phoneOtp = safeString(body.phone_otp);

    safeLog(
      "auth.customer.signup.verify.requested",
      {
        requestId,
        route: "/api/customer-auth/signup/verify",
        hasSession: Boolean(signupSessionId),
      },
      req
    );

    const context = readCustomerSignupFlowContext(req);
    if (!context || !context.sessionId) {
      return apiError(req, 400, "SIGNUP_SESSION_EXPIRED", "Signup session expired. Start again.");
    }
    if (signupSessionId !== context.sessionId) {
      return apiError(req, 400, "SIGNUP_SESSION_MISMATCH", "Signup session mismatch. Start again.");
    }
    if (!emailOtp || !phoneOtp) {
      return apiError(
        req,
        400,
        "OTP_REQUIRED",
        "Email OTP and mobile OTP are both required."
      );
    }

    const emailVerify = await verifyEmailOtp({ email: context.email, token: emailOtp });
    const userId = safeString(emailVerify.user?.id);
    if (!userId) {
      return apiError(req, 401, "EMAIL_OTP_INVALID", "Email OTP verification failed.");
    }

    const identity = await ensureIdentityProfile({
      userId,
      role: "customer",
      trustedRoleAssignment: true,
      email: emailVerify.user?.email || context.email,
      phone: context.phone,
      fullName:
        safeString(emailVerify.user?.user_metadata?.full_name) ||
        safeString(emailVerify.user?.user_metadata?.name) ||
        undefined,
    });
    if (identity && identity.role !== "customer") {
      return apiError(req, 403, "FORBIDDEN_ROLE", "This account is not available for customer signup.");
    }

    const phoneOwner = await getCustomerAuthStateByPhone(context.phone);
    if (phoneOwner && phoneOwner.userId !== userId && isExistingCustomerAccount(phoneOwner)) {
      return apiError(
        req,
        409,
        "PHONE_ALREADY_IN_USE",
        "This mobile number is already linked with another account."
      );
    }

    const phoneVerify = await verifyOtpWithTwilio({ phone: context.phone, token: phoneOtp });
    if (!phoneVerify.approved) {
      return apiError(req, 401, "PHONE_OTP_INVALID", "Mobile OTP verification failed.");
    }

    const resolved = await getIdentityProfileByUserId(userId);
    const response = apiSuccess(req, {
      ok_to_set_password: true,
      signup_session_id: signupSessionId,
      user_id: userId,
    });
    setCustomerSignupFlowContext(response, {
      sessionId: signupSessionId,
      email: context.email,
      phone: context.phone,
      userId,
      emailVerified: true,
      phoneVerified: true,
    });

    safeLog(
      "auth.customer.signup.verify.success",
      {
        requestId,
        route: "/api/customer-auth/signup/verify",
        role: resolved?.role || "customer",
      },
      req
    );
    return response;
  } catch (error) {
    safeLog(
      "auth.customer.signup.verify.failed",
      {
        requestId,
        route: "/api/customer-auth/signup/verify",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "email_otp_invalid"
              : error instanceof TwilioVerifyUnavailableError
                ? "twilio_verify_unavailable"
                : error instanceof TwilioVerifyRequestError
                  ? error.code || "phone_otp_invalid"
                  : "signup_verify_failed",
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
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(req, 401, "EMAIL_OTP_INVALID", "Email OTP verification failed.");
    }
    if (error instanceof TwilioVerifyRequestError) {
      return apiError(req, 401, "PHONE_OTP_INVALID", "Mobile OTP verification failed.");
    }
    return apiError(req, 500, "SIGNUP_VERIFY_FAILED", "Failed to verify signup OTP.");
  }
}

