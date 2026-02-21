type OtpState = {
  lastSentAt: number;
  failedAttempts: number;
  blockedUntil: number;
};

const otpStateByMobile = new Map<string, OtpState>();

const SEND_COOLDOWN_SECONDS = 45;
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_SECONDS = 15 * 60;

function getState(mobile: string): OtpState {
  const existing = otpStateByMobile.get(mobile);
  if (existing) return existing;
  const initial: OtpState = {
    lastSentAt: 0,
    failedAttempts: 0,
    blockedUntil: 0,
  };
  otpStateByMobile.set(mobile, initial);
  return initial;
}

export function checkOtpSendAllowed(mobile: string): {
  ok: boolean;
  reason?: "cooldown" | "blocked";
  retryAfterSeconds?: number;
} {
  const state = getState(mobile);
  const now = Date.now();

  if (state.blockedUntil > now) {
    return {
      ok: false,
      reason: "blocked",
      retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
    };
  }

  const cooldownEnd = state.lastSentAt + SEND_COOLDOWN_SECONDS * 1000;
  if (cooldownEnd > now) {
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSeconds: Math.ceil((cooldownEnd - now) / 1000),
    };
  }

  return { ok: true };
}

export function markOtpSent(mobile: string): void {
  const state = getState(mobile);
  state.lastSentAt = Date.now();
}

export function checkOtpVerifyAllowed(mobile: string): {
  ok: boolean;
  retryAfterSeconds?: number;
} {
  const state = getState(mobile);
  const now = Date.now();
  if (state.blockedUntil > now) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((state.blockedUntil - now) / 1000),
    };
  }
  return { ok: true };
}

export function markOtpVerifySuccess(mobile: string): void {
  const state = getState(mobile);
  state.failedAttempts = 0;
  state.blockedUntil = 0;
}

export function markOtpVerifyFailure(mobile: string): {
  blocked: boolean;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
} {
  const state = getState(mobile);
  state.failedAttempts += 1;

  if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    state.blockedUntil = Date.now() + BLOCK_SECONDS * 1000;
    state.failedAttempts = 0;
    return {
      blocked: true,
      retryAfterSeconds: BLOCK_SECONDS,
    };
  }

  return {
    blocked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - state.failedAttempts,
  };
}

