import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";

type GenericRow = Record<string, unknown>;

export interface CustomerAccountProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  nationality: string | null;
  city: string | null;
  dob: string | null;
  preferred_airport: string | null;
  passport_no: string | null;
  passport_expiry: string | null;
  pan: string | null;
  travel_type: string | null;
  profile_completed: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerTraveller {
  id: string;
  customer_id: string;
  name: string | null;
  passport_no: string | null;
  expiry_date: string | null;
  relationship: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerWallet {
  customer_id: string;
  balance: number;
  tier: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes";
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isMissingTableError(error: unknown, table: string): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes(`relation "${table.toLowerCase()}" does not exist`);
}

function mapProfile(row: GenericRow | null): CustomerAccountProfile | null {
  if (!row) return null;
  const id = safeString(row.id);
  if (!id) return null;
  return {
    id,
    full_name: safeString(row.full_name) || null,
    email: safeString(row.email) || null,
    phone: safeString(row.phone) || null,
    phone_verified: toBoolean(row.phone_verified),
    nationality: safeString(row.nationality) || null,
    city: safeString(row.city) || null,
    dob: safeString(row.dob) || null,
    preferred_airport: safeString(row.preferred_airport) || null,
    passport_no: safeString(row.passport_no) || null,
    passport_expiry: safeString(row.passport_expiry) || null,
    pan: safeString(row.pan) || null,
    travel_type: safeString(row.travel_type) || null,
    profile_completed: toBoolean(row.profile_completed),
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
  };
}

function mapTraveller(row: GenericRow): CustomerTraveller | null {
  const id = safeString(row.id);
  const customerId = safeString(row.customer_id);
  if (!id || !customerId) return null;
  return {
    id,
    customer_id: customerId,
    name: safeString(row.name) || null,
    passport_no: safeString(row.passport_no) || null,
    expiry_date: safeString(row.expiry_date) || null,
    relationship: safeString(row.relationship) || null,
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
  };
}

export async function getCustomerProfileCompletionStatus(userId: string): Promise<boolean> {
  const id = safeString(userId);
  if (!id) return true;
  try {
    const db = new SupabaseRestClient();
    const row = await db.selectSingle<GenericRow>(
      "customer_profiles",
      new URLSearchParams({
        select: "id,profile_completed",
        id: `eq.${id}`,
      })
    );
    if (!row) return false;
    return toBoolean(row.profile_completed);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return true;
    if (isMissingTableError(error, "customer_profiles")) return true;
    return true;
  }
}

export async function getCustomerProfile(userId: string): Promise<CustomerAccountProfile | null> {
  const id = safeString(userId);
  if (!id) return null;

  try {
    const db = new SupabaseRestClient();
    const row = await db.selectSingle<GenericRow>(
      "customer_profiles",
      new URLSearchParams({
        select:
          "id,full_name,email,phone,phone_verified,nationality,city,dob,preferred_airport,passport_no,passport_expiry,pan,travel_type,profile_completed,created_at,updated_at",
        id: `eq.${id}`,
      })
    );
    return mapProfile(row);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    if (isMissingTableError(error, "customer_profiles")) return null;
    throw error;
  }
}

export async function ensureCustomerProfile(userId: string): Promise<CustomerAccountProfile | null> {
  const id = safeString(userId);
  if (!id) return null;

  const existing = await getCustomerProfile(id);
  if (existing) return existing;

  try {
    const identity = await getIdentityProfileByUserId(id);
    const db = new SupabaseRestClient();
    const inserted = await db.insertSingle<GenericRow>("customer_profiles", {
      id,
      full_name: identity?.full_name || null,
      email: identity?.email || null,
      phone: identity?.phone || null,
      phone_verified: Boolean(identity?.phone),
      city: identity?.city || null,
      nationality: "India",
      profile_completed: false,
    });
    return mapProfile(inserted);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    if (isMissingTableError(error, "customer_profiles")) return null;
    return null;
  }
}

export async function upsertCustomerProfile(
  userId: string,
  patch: Record<string, unknown>
): Promise<CustomerAccountProfile | null> {
  const id = safeString(userId);
  if (!id) return null;

  const allowedKeys = new Set([
    "full_name",
    "email",
    "phone",
    "phone_verified",
    "nationality",
    "city",
    "dob",
    "preferred_airport",
    "passport_no",
    "passport_expiry",
    "pan",
    "travel_type",
    "profile_completed",
  ]);

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!allowedKeys.has(key)) continue;
    payload[key] = value;
  }

  if (!Object.prototype.hasOwnProperty.call(payload, "updated_at")) {
    payload.updated_at = new Date().toISOString();
  }

  try {
    const db = new SupabaseRestClient();
    const existing = await getCustomerProfile(id);
    if (!existing) {
      const identity = await getIdentityProfileByUserId(id);
      const inserted = await db.insertSingle<GenericRow>("customer_profiles", {
        id,
        full_name: safeString(payload.full_name) || identity?.full_name || null,
        email: safeString(payload.email) || identity?.email || null,
        phone: safeString(payload.phone) || identity?.phone || null,
        phone_verified:
          typeof payload.phone_verified === "boolean"
            ? payload.phone_verified
            : Boolean(identity?.phone),
        nationality: safeString(payload.nationality) || "India",
        city: safeString(payload.city) || identity?.city || null,
        dob: safeString(payload.dob) || null,
        preferred_airport: safeString(payload.preferred_airport) || null,
        passport_no: safeString(payload.passport_no) || null,
        passport_expiry: safeString(payload.passport_expiry) || null,
        pan: safeString(payload.pan) || null,
        travel_type: safeString(payload.travel_type) || null,
        profile_completed: toBoolean(payload.profile_completed),
        updated_at: payload.updated_at,
      });
      return mapProfile(inserted);
    }

    const updated = await db.updateSingle<GenericRow>(
      "customer_profiles",
      new URLSearchParams({
        select:
          "id,full_name,email,phone,phone_verified,nationality,city,dob,preferred_airport,passport_no,passport_expiry,pan,travel_type,profile_completed,created_at,updated_at",
        id: `eq.${id}`,
      }),
      payload
    );
    return mapProfile(updated);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    if (isMissingTableError(error, "customer_profiles")) return null;
    throw error;
  }
}

export async function listCustomerTravellers(userId: string): Promise<CustomerTraveller[]> {
  const id = safeString(userId);
  if (!id) return [];
  try {
    const db = new SupabaseRestClient();
    const rows = await db.selectMany<GenericRow>(
      "travellers",
      new URLSearchParams({
        select: "id,customer_id,name,passport_no,expiry_date,relationship,created_at,updated_at",
        customer_id: `eq.${id}`,
        order: "created_at.desc",
        limit: "50",
      })
    );
    return rows.map(mapTraveller).filter((row): row is CustomerTraveller => Boolean(row));
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return [];
    if (isMissingTableError(error, "travellers")) return [];
    return [];
  }
}

export async function createCustomerTraveller(
  userId: string,
  payload: {
    name: string;
    passport_no?: string;
    expiry_date?: string;
    relationship?: string;
  }
): Promise<CustomerTraveller | null> {
  const id = safeString(userId);
  if (!id) return null;
  try {
    const db = new SupabaseRestClient();
    const inserted = await db.insertSingle<GenericRow>("travellers", {
      customer_id: id,
      name: safeString(payload.name),
      passport_no: safeString(payload.passport_no) || null,
      expiry_date: safeString(payload.expiry_date) || null,
      relationship: safeString(payload.relationship) || null,
      updated_at: new Date().toISOString(),
    });
    return mapTraveller(inserted);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    if (isMissingTableError(error, "travellers")) return null;
    return null;
  }
}

export async function updateCustomerTraveller(
  userId: string,
  travellerId: string,
  patch: Record<string, unknown>
): Promise<CustomerTraveller | null> {
  const id = safeString(userId);
  const rowId = safeString(travellerId);
  if (!id || !rowId) return null;
  const payload = {
    ...(Object.prototype.hasOwnProperty.call(patch, "name") ? { name: safeString(patch.name) } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "passport_no")
      ? { passport_no: safeString(patch.passport_no) || null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "expiry_date")
      ? { expiry_date: safeString(patch.expiry_date) || null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, "relationship")
      ? { relationship: safeString(patch.relationship) || null }
      : {}),
    updated_at: new Date().toISOString(),
  };

  try {
    const db = new SupabaseRestClient();
    const updated = await db.updateSingle<GenericRow>(
      "travellers",
      new URLSearchParams({
        select: "id,customer_id,name,passport_no,expiry_date,relationship,created_at,updated_at",
        id: `eq.${rowId}`,
        customer_id: `eq.${id}`,
      }),
      payload
    );
    return updated ? mapTraveller(updated) : null;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    if (isMissingTableError(error, "travellers")) return null;
    return null;
  }
}

export async function deleteCustomerTraveller(
  userId: string,
  travellerId: string
): Promise<boolean> {
  const id = safeString(userId);
  const rowId = safeString(travellerId);
  if (!id || !rowId) return false;
  try {
    const db = new SupabaseRestClient();
    await db.deleteSingle<GenericRow>(
      "travellers",
      new URLSearchParams({
        id: `eq.${rowId}`,
        customer_id: `eq.${id}`,
      })
    );
    return true;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return false;
    if (isMissingTableError(error, "travellers")) return false;
    return false;
  }
}

export async function getCustomerWallet(userId: string): Promise<CustomerWallet | null> {
  const id = safeString(userId);
  if (!id) return null;
  try {
    const db = new SupabaseRestClient();
    const row = await db.selectSingle<GenericRow>(
      "customer_wallet",
      new URLSearchParams({
        select: "customer_id,balance,tier",
        customer_id: `eq.${id}`,
      })
    );
    if (!row) {
      const inserted = await db.insertSingle<GenericRow>("customer_wallet", {
        customer_id: id,
        balance: 0,
        tier: "Explorer",
      });
      return {
        customer_id: safeString(inserted.customer_id) || id,
        balance: toNumber(inserted.balance),
        tier: safeString(inserted.tier) || "Explorer",
      };
    }
    return {
      customer_id: safeString(row.customer_id) || id,
      balance: toNumber(row.balance),
      tier: safeString(row.tier) || "Explorer",
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    if (isMissingTableError(error, "customer_wallet")) return null;
    return null;
  }
}
