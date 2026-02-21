import crypto from "node:crypto";
import { getDb } from "@/lib/backend/sqlite";

export interface CustomerRecord {
  id: string;
  provider: "google" | "mobile_otp";
  providerUserId: string;
  email?: string;
  phone?: string;
  fullName: string;
  createdAt: string;
  lastLoginAt: string;
  passwordHash?: string;
  passwordUpdatedAt?: string;
}

function mapRow(row: {
  id: string;
  provider: "google" | "mobile_otp";
  provider_user_id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  created_at: string;
  last_login_at: string;
  password_hash: string | null;
  password_updated_at: string | null;
}): CustomerRecord {
  return {
    id: row.id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    fullName: row.full_name,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    passwordHash: row.password_hash ?? undefined,
    passwordUpdatedAt: row.password_updated_at ?? undefined,
  };
}

export function upsertCustomer(input: {
  provider: "google" | "mobile_otp";
  providerUserId: string;
  fullName: string;
  email?: string;
  phone?: string;
}): CustomerRecord {
  const db = getDb();
  const customerId = crypto.randomUUID();

  db.prepare(
    `
      INSERT INTO customers (
        id,
        provider,
        provider_user_id,
        email,
        phone,
        full_name,
        last_login_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(provider, provider_user_id) DO UPDATE SET
        email = COALESCE(excluded.email, customers.email),
        phone = COALESCE(excluded.phone, customers.phone),
        full_name = excluded.full_name,
        last_login_at = datetime('now')
    `
  ).run(
    customerId,
    input.provider,
    input.providerUserId,
    input.email ?? null,
    input.phone ?? null,
    input.fullName
  );

  const row = db
    .prepare(
      `
        SELECT
          id,
          provider,
          provider_user_id,
          email,
          phone,
          full_name,
          created_at,
          last_login_at,
          password_hash,
          password_updated_at
        FROM customers
        WHERE provider = ? AND provider_user_id = ?
      `
    )
    .get(input.provider, input.providerUserId) as
    | {
        id: string;
        provider: "google" | "mobile_otp";
        provider_user_id: string;
        email: string | null;
        phone: string | null;
        full_name: string;
        created_at: string;
        last_login_at: string;
        password_hash: string | null;
        password_updated_at: string | null;
      }
    | undefined;

  if (!row) {
    throw new Error("Failed to upsert customer.");
  }

  return mapRow(row);
}

export function getCustomerById(id: string): CustomerRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          id,
          provider,
          provider_user_id,
          email,
          phone,
          full_name,
          created_at,
          last_login_at,
          password_hash,
          password_updated_at
        FROM customers
        WHERE id = ?
      `
    )
    .get(id) as
    | {
        id: string;
        provider: "google" | "mobile_otp";
        provider_user_id: string;
        email: string | null;
        phone: string | null;
        full_name: string;
        created_at: string;
        last_login_at: string;
        password_hash: string | null;
        password_updated_at: string | null;
      }
    | undefined;

  if (!row) return null;
  return mapRow(row);
}

export function getCustomerByPhone(phone: string): CustomerRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          id,
          provider,
          provider_user_id,
          email,
          phone,
          full_name,
          created_at,
          last_login_at,
          password_hash,
          password_updated_at
        FROM customers
        WHERE phone = ?
      `
    )
    .get(phone) as
    | {
        id: string;
        provider: "google" | "mobile_otp";
        provider_user_id: string;
        email: string | null;
        phone: string | null;
        full_name: string;
        created_at: string;
        last_login_at: string;
        password_hash: string | null;
        password_updated_at: string | null;
      }
    | undefined;

  if (!row) return null;
  return mapRow(row);
}

export function updateCustomerPassword(
  customerId: string,
  passwordHash: string
): void {
  const db = getDb();
  db.prepare(
    `
      UPDATE customers
      SET
        password_hash = ?,
        password_updated_at = datetime('now')
      WHERE id = ?
    `
  ).run(passwordHash, customerId);
}
