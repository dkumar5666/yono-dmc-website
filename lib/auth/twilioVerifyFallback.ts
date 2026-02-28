import "server-only";

import { getTwilioVerifyConfig } from "@/lib/backend/twilioVerifyConfig";

const TWILIO_VERIFY_API_BASE = "https://verify.twilio.com/v2";

interface TwilioVerifyApiError {
  message?: string;
  code?: number | string;
}

export class TwilioVerifyUnavailableError extends Error {
  constructor(message = "Twilio Verify is not configured.") {
    super(message);
    this.name = "TwilioVerifyUnavailableError";
  }
}

export class TwilioVerifyRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "TwilioVerifyRequestError";
  }
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function toMessage(payload: TwilioVerifyApiError | null, fallback: string): string {
  return payload?.message || fallback;
}

export function isTwilioVerifyConfigured(): boolean {
  return getTwilioVerifyConfig().ok;
}

type TwilioVerifyChannel = "sms" | "email";

async function sendOtpWithTwilioTarget(params: {
  to: string;
  channel: TwilioVerifyChannel;
}): Promise<{ challengeId?: string }> {
  const config = getTwilioVerifyConfig();
  if (!config.ok) {
    throw new TwilioVerifyUnavailableError(config.error.message);
  }

  const { accountSid, authToken, verifyServiceSid } = config.value;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const apiUrl = `${TWILIO_VERIFY_API_BASE}/Services/${verifyServiceSid}/Verifications`;
  const payload = new URLSearchParams({
    To: params.to,
    Channel: params.channel,
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await parseJsonSafe<TwilioVerifyApiError>(response);
    throw new TwilioVerifyRequestError(
      toMessage(body, `Twilio OTP send failed (${response.status})`),
      response.status,
      typeof body?.code === "string" ? body.code : body?.code ? String(body.code) : undefined
    );
  }

  const data = (await parseJsonSafe<Record<string, unknown>>(response)) || {};
  const challengeId = typeof data.sid === "string" ? data.sid : undefined;
  return { challengeId };
}

export async function sendOtpWithTwilio(phone: string): Promise<{ challengeId?: string }> {
  return sendOtpWithTwilioTarget({ to: phone, channel: "sms" });
}

export async function sendEmailOtpWithTwilio(email: string): Promise<{ challengeId?: string }> {
  return sendOtpWithTwilioTarget({ to: email, channel: "email" });
}

async function verifyOtpWithTwilioTarget(params: {
  to: string;
  token: string;
}): Promise<{ approved: boolean; challengeId?: string; status?: string }> {
  const config = getTwilioVerifyConfig();
  if (!config.ok) {
    throw new TwilioVerifyUnavailableError(config.error.message);
  }

  const { accountSid, authToken, verifyServiceSid } = config.value;
  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const apiUrl = `${TWILIO_VERIFY_API_BASE}/Services/${verifyServiceSid}/VerificationCheck`;
  const payload = new URLSearchParams({
    To: params.to,
    Code: params.token,
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await parseJsonSafe<TwilioVerifyApiError>(response);
    throw new TwilioVerifyRequestError(
      toMessage(body, `Twilio OTP verify failed (${response.status})`),
      response.status,
      typeof body?.code === "string" ? body.code : body?.code ? String(body.code) : undefined
    );
  }

  const data = (await parseJsonSafe<Record<string, unknown>>(response)) || {};
  const status = typeof data.status === "string" ? data.status : undefined;
  const challengeId = typeof data.sid === "string" ? data.sid : undefined;
  return {
    approved: status === "approved",
    challengeId,
    status,
  };
}

export async function verifyOtpWithTwilio(params: {
  phone: string;
  token: string;
}): Promise<{ approved: boolean; challengeId?: string; status?: string }> {
  return verifyOtpWithTwilioTarget({ to: params.phone, token: params.token });
}

export async function verifyEmailOtpWithTwilio(params: {
  email: string;
  token: string;
}): Promise<{ approved: boolean; challengeId?: string; status?: string }> {
  return verifyOtpWithTwilioTarget({ to: params.email, token: params.token });
}
