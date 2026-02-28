export interface TwilioVerifyConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
}

export interface TwilioVerifyConfigError {
  code: "TWILIO_ENV_MISSING" | "TWILIO_ENV_INVALID";
  message: string;
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function isValidAccountSid(value: string): boolean {
  return /^AC[a-zA-Z0-9]{32}$/.test(value);
}

function isValidVerifyServiceSid(value: string): boolean {
  return /^VA[a-zA-Z0-9]{32}$/.test(value);
}

export function getTwilioVerifyConfig():
  | { ok: true; value: TwilioVerifyConfig }
  | { ok: false; error: TwilioVerifyConfigError } {
  const accountSid = readEnv("TWILIO_ACCOUNT_SID");
  const authToken = readEnv("TWILIO_AUTH_TOKEN");
  const verifyServiceSid =
    readEnv("TWILIO_VERIFY_SERVICE_SID") || readEnv("TWILIO_VERIFY_SID");

  if (!accountSid || !authToken || !verifyServiceSid) {
    return {
      ok: false,
      error: {
        code: "TWILIO_ENV_MISSING",
        message:
          "Twilio Verify environment variables are missing. Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID (or TWILIO_VERIFY_SID)",
      },
    };
  }

  if (!isValidAccountSid(accountSid) || !isValidVerifyServiceSid(verifyServiceSid)) {
    return {
      ok: false,
      error: {
        code: "TWILIO_ENV_INVALID",
        message:
          "Twilio Verify credentials are invalid. Check TWILIO_ACCOUNT_SID (AC...) and TWILIO_VERIFY_SERVICE_SID (VA...).",
      },
    };
  }

  return {
    ok: true,
    value: {
      accountSid,
      authToken,
      verifyServiceSid,
    },
  };
}
