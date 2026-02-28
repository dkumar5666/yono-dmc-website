import "server-only";

import { SupabaseRestClient } from "@/lib/core/supabase-rest";

export interface SupplierSignupRequestRow {
  id?: string | null;
  status?: string | null;
  business_type?: string | null;
  company_legal_name?: string | null;
  brand_name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  alt_phone?: string | null;
  support_email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  cin?: string | null;
  iata_code?: string | null;
  license_no?: string | null;
  bank_meta?: Record<string, unknown> | null;
  docs?: Record<string, unknown> | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  meta?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    const rows = await db.selectMany<T>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function safeInsert<T>(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<T | null> {
  try {
    return await db.insertSingle<T>(table, payload);
  } catch {
    return null;
  }
}

export async function safeUpdate<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams,
  payload: Record<string, unknown>
): Promise<T | null> {
  try {
    return await db.updateSingle<T>(table, query, payload);
  } catch {
    return null;
  }
}

export async function getSupplierSignupRequestById(
  db: SupabaseRestClient,
  requestId: string
): Promise<SupplierSignupRequestRow | null> {
  const id = safeString(requestId);
  if (!id) return null;

  const attempts = [
    "id,status,business_type,company_legal_name,brand_name,address,city,country,website,contact_name,contact_email,contact_phone,alt_phone,support_email,gstin,pan,cin,iata_code,license_no,bank_meta,docs,email_verified,phone_verified,meta,created_at,updated_at",
    "*",
  ];

  for (const select of attempts) {
    try {
      const row = await db.selectSingle<SupplierSignupRequestRow>(
        "supplier_signup_requests",
        new URLSearchParams({
          select,
          id: `eq.${id}`,
          limit: "1",
        })
      );
      if (row) return row;
    } catch {
      // table/column may be missing
    }
  }
  return null;
}

export async function updateSupplierSignupRequest(
  db: SupabaseRestClient,
  requestId: string,
  payload: Record<string, unknown>
): Promise<SupplierSignupRequestRow | null> {
  const id = safeString(requestId);
  if (!id) return null;
  const base = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  const attempts = [
    base,
    Object.fromEntries(Object.entries(base).filter(([key]) => key !== "updated_at")),
  ];

  for (const body of attempts) {
    const row = await safeUpdate<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      new URLSearchParams({
        select: "*",
        id: `eq.${id}`,
      }),
      body
    );
    if (row) return row;
  }
  return null;
}

export async function logSupplierSignupSystemEvent(
  db: SupabaseRestClient,
  params: {
    requestId: string;
    event: string;
    message: string;
    meta?: Record<string, unknown>;
    level?: string;
  }
): Promise<void> {
  const requestId = safeString(params.requestId);
  if (!requestId) return;
  const payloadMeta = safeObject(params.meta);

  const candidates: Array<Record<string, unknown>> = [
    {
      level: params.level || "info",
      event: params.event,
      message: params.message,
      entity_type: "supplier_signup_request",
      entity_id: requestId,
      metadata: payloadMeta,
      meta: payloadMeta,
      created_at: new Date().toISOString(),
    },
    {
      event: params.event,
      message: params.message,
      entity_type: "supplier_signup_request",
      entity_id: requestId,
      meta: payloadMeta,
    },
    {
      event: params.event,
      message: params.message,
      meta: payloadMeta,
    },
  ];

  for (const payload of candidates) {
    const inserted = await safeInsert<Record<string, unknown>>(db, "system_logs", payload);
    if (inserted) return;
  }
}
