import { verifyPasswordResetToken } from "@/lib/backend/passwordReset";
import { updateCustomerPassword } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { logError } from "@/lib/backend/logger";
import { hashPassword, validatePasswordStrength } from "@/lib/backend/password";

interface ResetPasswordBody {
  resetToken?: string;
  newPassword?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ResetPasswordBody;
    const resetToken = (body.resetToken ?? "").trim();
    const newPassword = (body.newPassword ?? "").trim();

    if (!resetToken || !newPassword) {
      return apiError(
        req,
        400,
        "RESET_INPUT_REQUIRED",
        "Reset token and new password are required."
      );
    }

    const tokenPayload = verifyPasswordResetToken(resetToken);
    if (!tokenPayload) {
      return apiError(
        req,
        401,
        "RESET_TOKEN_INVALID",
        "Reset session is invalid or expired. Please verify OTP again."
      );
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return apiError(req, 400, "PASSWORD_WEAK", passwordError);
    }

    const passwordHash = await hashPassword(newPassword);
    updateCustomerPassword(tokenPayload.customerId, passwordHash);

    return apiSuccess(req, { reset: true });
  } catch (error) {
    logError("FORGOT PASSWORD RESET ERROR", { error });
    return apiError(req, 500, "FORGOT_PASSWORD_RESET_ERROR", "Failed to reset password.");
  }
}

