import { apiError, apiSuccess } from "@/lib/backend/http";
import { sendEmailOtp, SupabaseAuthRequestError, SupabaseAuthUnavailableError } from "@/lib/auth/supabaseAuthProvider";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { sanitizeNextPath } from "@/lib/auth/supabaseSession";

const OTP_UNAVAILABLE_MESSAGE =
  "OTP service temporarily unavailable, please try Google login or retry in 2 minutes.";

interface SendEmailOtpBody {
  email?: string;
  next?: string;
}

function normalizeEmail(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as SendEmailOtpBody;
    const email = normalizeEmail(body.email);
    const nextPath = sanitizeNextPath(body.next);

    safeLog(
      "auth.supabase.email_otp.send.requested",
      {
        requestId,
        route: "/api/auth/supabase/email-otp/send",
        hasNext: Boolean(nextPath),
      },
      req
    );

    if (!email) {
      return apiError(req, 400, "missing_email", "Email is required.");
    }
    if (!isValidEmail(email)) {
      return apiError(req, 400, "invalid_email", "Enter a valid email address.");
    }

    await sendEmailOtp({ email });

    safeLog(
      "auth.supabase.email_otp.send.success",
      {
        requestId,
        route: "/api/auth/supabase/email-otp/send",
        outcome: "success",
      },
      req
    );

    return apiSuccess(req, { sent: true });
  } catch (error) {
    safeLog(
      "auth.supabase.email_otp.send.failed",
      {
        requestId,
        route: "/api/auth/supabase/email-otp/send",
        outcome: "fail",
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
      return apiError(req, 503, "supabase_auth_not_configured", OTP_UNAVAILABLE_MESSAGE);
    }
    if (error instanceof SupabaseAuthRequestError) {
      const code = error.status === 400 || error.status === 422 ? "otp_send_failed" : "otp_provider_unavailable";
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        code,
        code === "otp_provider_unavailable" ? OTP_UNAVAILABLE_MESSAGE : error.message
      );
    }

    return apiError(req, 500, "otp_send_failed", "Failed to send email OTP.");
  }
}

