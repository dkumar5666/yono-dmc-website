import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient, getSupabaseConfig } from "@/lib/core/supabase-rest";
import { IdentityRole, normalizeRole } from "@/lib/auth/supabaseSession";

type GenericRow = Record<string, unknown>;
const SELF_SIGNUP_ROLES = new Set<IdentityRole>(["customer", "agent", "supplier"]);

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface IdentityProfile {
  id: string;
  role: IdentityRole;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  city: string | null;
  country: string | null;
  status: string | null;
}

function toProfile(row: GenericRow | null): IdentityProfile | null {
  if (!row) return null;
  const id = safeString(row.id);
  const role = normalizeRole(safeString(row.role)) || "customer";
  if (!id) return null;
  return {
    id,
    role,
    full_name: safeString(row.full_name) || null,
    email: safeString(row.email) || null,
    phone: safeString(row.phone) || null,
    company_name: safeString(row.company_name) || null,
    city: safeString(row.city) || null,
    country: safeString(row.country) || null,
    status: safeString(row.status) || null,
  };
}

async function setAuthUserAppMetadataRole(userId: string, role: IdentityRole): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  try {
    await fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_metadata: { role },
      }),
      cache: "no-store",
    });
  } catch {
    // Best effort only.
  }
}

async function ensureAgentProfile(
  db: SupabaseRestClient,
  userId: string,
  input: {
    agencyName?: string;
    city?: string;
    taxId?: string;
    governmentId?: string;
    officeAddress?: string;
  }
): Promise<void> {
  const officeAddress = safeString(input.officeAddress) || safeString(input.city) || "";
  const governmentId = safeString(input.governmentId);
  const taxId = safeString(input.taxId);

  const query = new URLSearchParams({
    select: "id,agency_name,gst_number,pan_number,office_address,meta",
    id: `eq.${userId}`,
  });
  const existing = await db.selectSingle<GenericRow>("agent_profiles", query).catch(() => null);
  if (existing) {
    const payload: Record<string, unknown> = {};
    if (!safeString(existing.agency_name) && safeString(input.agencyName)) {
      payload.agency_name = safeString(input.agencyName);
    }
    if (!safeString(existing.gst_number) && taxId) {
      payload.gst_number = taxId;
    }
    if (!safeString(existing.pan_number) && governmentId) {
      payload.pan_number = governmentId;
    }
    if (!safeString(existing.office_address) && officeAddress) {
      payload.office_address = officeAddress;
    }

    const existingMeta =
      existing.meta && typeof existing.meta === "object" && !Array.isArray(existing.meta)
        ? (existing.meta as Record<string, unknown>)
        : {};
    if (!safeString(existingMeta.government_id) && governmentId) {
      payload.meta = { ...existingMeta, government_id: governmentId };
    }

    if (Object.keys(payload).length > 0) {
      const variants: Array<Record<string, unknown>> = [
        payload,
        {
          agency_name: payload.agency_name,
          office_address: payload.office_address,
        },
      ];
      for (const variant of variants) {
        const compact = Object.fromEntries(
          Object.entries(variant).filter(([, value]) => value !== undefined)
        );
        if (Object.keys(compact).length === 0) continue;
        const updated = await db
          .updateSingle<GenericRow>(
            "agent_profiles",
            new URLSearchParams({ id: `eq.${userId}` }),
            compact
          )
          .catch(() => null);
        if (updated) break;
      }
    }
    return;
  }

  const insertVariants: Array<Record<string, unknown>> = [
    {
      id: userId,
      agency_name: safeString(input.agencyName) || null,
      gst_number: taxId || null,
      pan_number: governmentId || null,
      office_address: officeAddress || null,
      verification_status: "pending",
      meta: governmentId ? { government_id: governmentId } : {},
    },
    {
      id: userId,
      agency_name: safeString(input.agencyName) || null,
      office_address: officeAddress || null,
      verification_status: "pending",
    },
  ];
  for (const payload of insertVariants) {
    const inserted = await db.insertSingle<GenericRow>("agent_profiles", payload).catch(() => null);
    if (inserted) break;
  }
}

async function ensureSupplierProfile(db: SupabaseRestClient, userId: string): Promise<void> {
  const existing = await db
    .selectSingle<GenericRow>(
      "supplier_profiles",
      new URLSearchParams({ select: "id", id: `eq.${userId}` })
    )
    .catch(() => null);
  if (existing) return;

  await db
    .insertSingle<GenericRow>("supplier_profiles", {
      id: userId,
      verification_status: "pending",
      api_enabled: false,
    })
    .catch(() => null);
}

export async function getIdentityProfileByUserId(userId: string): Promise<IdentityProfile | null> {
  const ref = safeString(userId);
  if (!ref) return null;
  try {
    const db = new SupabaseRestClient();
    const profile = await db.selectSingle<GenericRow>(
      "profiles",
      new URLSearchParams({
        select: "id,role,full_name,email,phone,company_name,city,country,status",
        id: `eq.${ref}`,
      })
    );
    return toProfile(profile);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

export async function ensureIdentityProfile(input: {
  userId: string;
  email?: string;
  phone?: string;
  fullName?: string;
  role?: IdentityRole;
  companyName?: string;
  governmentId?: string;
  taxId?: string;
  officeAddress?: string;
  city?: string;
  country?: string;
  trustedRoleAssignment?: boolean;
}): Promise<IdentityProfile | null> {
  const userId = safeString(input.userId);
  if (!userId) return null;

  try {
    const db = new SupabaseRestClient();
    const existing = await db
      .selectSingle<GenericRow>(
        "profiles",
        new URLSearchParams({
          select: "id,role,full_name,email,phone,company_name,city,country,status",
          id: `eq.${userId}`,
        })
      )
      .catch(() => null);

    const requestedRole = normalizeRole(input.role);
    const trustedRoleAssignment = input.trustedRoleAssignment === true;

    const resolveAllowedRole = (existingRole?: IdentityRole): IdentityRole => {
      if (trustedRoleAssignment && requestedRole) return requestedRole;
      if (existingRole === "admin" || existingRole === "supplier") return existingRole;
      if (requestedRole && SELF_SIGNUP_ROLES.has(requestedRole)) return requestedRole;
      if (existingRole === "agent" || existingRole === "customer") return existingRole;
      return "customer";
    };

    const targetRole = resolveAllowedRole(undefined);

    if (!existing) {
      const inserted = await db.insertSingle<GenericRow>("profiles", {
        id: userId,
        role: targetRole,
        full_name: safeString(input.fullName) || null,
        email: safeString(input.email) || null,
        phone: safeString(input.phone) || null,
        company_name: safeString(input.companyName) || null,
        city: safeString(input.city) || null,
        country: safeString(input.country) || "India",
        status: "active",
      });

      if (targetRole === "agent") {
        await ensureAgentProfile(db, userId, {
          agencyName: input.companyName,
          taxId: input.taxId,
          governmentId: input.governmentId,
          officeAddress: input.officeAddress,
          city: input.city,
        });
      } else if (targetRole === "supplier") {
        await ensureSupplierProfile(db, userId);
      }

      await setAuthUserAppMetadataRole(userId, targetRole);
      return toProfile(inserted);
    }

    const updates: Record<string, unknown> = {};
    const existingRole = normalizeRole(safeString(existing.role)) || "customer";
    const nextAllowedRole = resolveAllowedRole(existingRole);

    if (nextAllowedRole !== existingRole) {
      updates.role = nextAllowedRole;
    }
    if (!safeString(existing.full_name) && safeString(input.fullName)) {
      updates.full_name = safeString(input.fullName);
    }
    if (!safeString(existing.email) && safeString(input.email)) {
      updates.email = safeString(input.email);
    }
    if (!safeString(existing.phone) && safeString(input.phone)) {
      updates.phone = safeString(input.phone);
    }
    if (!safeString(existing.company_name) && safeString(input.companyName)) {
      updates.company_name = safeString(input.companyName);
    }
    if (!safeString(existing.city) && safeString(input.city)) {
      updates.city = safeString(input.city);
    }

    const nextRole = normalizeRole(safeString(updates.role)) || existingRole || targetRole;

    let updated: GenericRow | null = existing;
    if (Object.keys(updates).length > 0) {
      updated = await db
        .updateSingle<GenericRow>(
          "profiles",
          new URLSearchParams({
            select: "id,role,full_name,email,phone,company_name,city,country,status",
            id: `eq.${userId}`,
          }),
          updates
        )
        .catch(() => existing);
    }

    if (nextRole === "agent") {
      await ensureAgentProfile(db, userId, {
        agencyName: input.companyName,
        taxId: input.taxId,
        governmentId: input.governmentId,
        officeAddress: input.officeAddress,
        city: input.city,
      });
    } else if (nextRole === "supplier") {
      await ensureSupplierProfile(db, userId);
    }

    await setAuthUserAppMetadataRole(userId, nextRole);
    return toProfile(updated ?? existing);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}
