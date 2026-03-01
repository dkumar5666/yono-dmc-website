import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { getIdentityProfileByEmail, getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";

type GenericRow = Record<string, unknown>;

export interface CustomerAuthState {
  userId: string;
  role: string;
  email: string | null;
  phoneE164: string | null;
  authProvider: "local" | "google";
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  passwordSetAt: string | null;
  profileCompleted: boolean;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes";
  }
  return false;
}

function isMissingColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

async function readCustomerProfileRow(db: SupabaseRestClient, userId: string): Promise<GenericRow | null> {
  const richQuery = new URLSearchParams({
    select:
      "id,email,phone,phone_verified,profile_completed,email_verified_at,phone_verified_at,auth_provider,password_set_at",
    id: `eq.${userId}`,
  });

  try {
    return await db.selectSingle<GenericRow>("customer_profiles", richQuery);
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
  }

  const fallbackQuery = new URLSearchParams({
    select: "id,email,phone,phone_verified,profile_completed",
    id: `eq.${userId}`,
  });
  return db.selectSingle<GenericRow>("customer_profiles", fallbackQuery);
}

function mapAuthState(input: {
  userId: string;
  role: string;
  identityEmail?: string | null;
  identityPhone?: string | null;
  row: GenericRow | null;
}): CustomerAuthState {
  const authProviderRaw = safeString(input.row?.auth_provider).toLowerCase();
  const authProvider: "local" | "google" = authProviderRaw === "google" ? "google" : "local";
  const emailVerifiedAt =
    safeString(input.row?.email_verified_at) ||
    (safeString(input.row?.email) || safeString(input.identityEmail) ? null : null);
  const phoneVerifiedAt =
    safeString(input.row?.phone_verified_at) ||
    (toBoolean(input.row?.phone_verified) && (safeString(input.row?.phone) || safeString(input.identityPhone))
      ? "legacy_verified"
      : null);

  return {
    userId: input.userId,
    role: input.role,
    email: safeString(input.row?.email) || safeString(input.identityEmail) || null,
    phoneE164: safeString(input.row?.phone) || safeString(input.identityPhone) || null,
    authProvider,
    emailVerifiedAt: emailVerifiedAt || null,
    phoneVerifiedAt: phoneVerifiedAt || null,
    passwordSetAt: safeString(input.row?.password_set_at) || null,
    profileCompleted: toBoolean(input.row?.profile_completed),
  };
}

export function isExistingCustomerAccount(state: CustomerAuthState | null): boolean {
  if (!state || state.role !== "customer") return false;
  const emailVerified = Boolean(state.emailVerifiedAt);
  const phoneVerified = Boolean(state.phoneVerifiedAt);
  const hasCredential = state.authProvider === "google" || Boolean(state.passwordSetAt);
  return emailVerified && phoneVerified && hasCredential;
}

export async function getCustomerAuthStateByUserId(
  userId: string
): Promise<CustomerAuthState | null> {
  const resolvedUserId = safeString(userId);
  if (!resolvedUserId) return null;

  try {
    const identity = await getIdentityProfileByUserId(resolvedUserId);
    if (!identity) return null;
    if (identity.role !== "customer") {
      return {
        userId: resolvedUserId,
        role: identity.role,
        email: identity.email || null,
        phoneE164: identity.phone || null,
        authProvider: "local",
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        passwordSetAt: null,
        profileCompleted: true,
      };
    }

    const db = new SupabaseRestClient();
    const row = await readCustomerProfileRow(db, resolvedUserId).catch(() => null);
    return mapAuthState({
      userId: resolvedUserId,
      role: identity.role,
      identityEmail: identity.email,
      identityPhone: identity.phone,
      row,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

export async function getCustomerAuthStateByEmail(
  email: string
): Promise<CustomerAuthState | null> {
  const normalizedEmail = safeString(email).toLowerCase();
  if (!normalizedEmail) return null;
  const identity = await getIdentityProfileByEmail(normalizedEmail);
  if (!identity) return null;
  return getCustomerAuthStateByUserId(identity.id);
}

export async function getCustomerAuthStateByPhone(
  phoneE164: string
): Promise<CustomerAuthState | null> {
  const phone = safeString(phoneE164);
  if (!phone) return null;

  try {
    const db = new SupabaseRestClient();
    const profileRow = await db.selectSingle<GenericRow>(
      "profiles",
      new URLSearchParams({
        select: "id,role,email,phone",
        phone: `eq.${phone}`,
        limit: "1",
      })
    );
    const userId = safeString(profileRow?.id);
    if (!userId) return null;
    return getCustomerAuthStateByUserId(userId);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

export async function persistCustomerAuthState(
  userId: string,
  patch: {
    email?: string | null;
    phone?: string | null;
    emailVerifiedAt?: string | null;
    phoneVerifiedAt?: string | null;
    authProvider?: "local" | "google" | null;
    passwordSetAt?: string | null;
    profileCompleted?: boolean;
  }
): Promise<void> {
  const resolvedUserId = safeString(userId);
  if (!resolvedUserId) return;
  try {
    const db = new SupabaseRestClient();
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      updated_at: now,
    };

    if (Object.prototype.hasOwnProperty.call(patch, "email")) {
      payload.email = patch.email || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "phone")) {
      payload.phone = patch.phone || null;
      payload.phone_verified = Boolean(patch.phoneVerifiedAt || patch.phone);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "profileCompleted")) {
      payload.profile_completed = Boolean(patch.profileCompleted);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "emailVerifiedAt")) {
      payload.email_verified_at = patch.emailVerifiedAt || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "phoneVerifiedAt")) {
      payload.phone_verified_at = patch.phoneVerifiedAt || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "authProvider")) {
      payload.auth_provider = patch.authProvider || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "passwordSetAt")) {
      payload.password_set_at = patch.passwordSetAt || null;
    }

    const existing = await db
      .selectSingle<GenericRow>(
        "customer_profiles",
        new URLSearchParams({
          select: "id",
          id: `eq.${resolvedUserId}`,
        })
      )
      .catch(() => null);

    if (existing) {
      await db
        .updateSingle<GenericRow>(
          "customer_profiles",
          new URLSearchParams({
            id: `eq.${resolvedUserId}`,
            select: "id",
          }),
          payload
        )
        .catch(() => null);
      return;
    }

    await db
      .insertSingle<GenericRow>("customer_profiles", {
        id: resolvedUserId,
        full_name: null,
        nationality: "India",
        city: null,
        profile_completed: false,
        ...payload,
      })
      .catch(() => null);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

