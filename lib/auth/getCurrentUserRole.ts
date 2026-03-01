import "server-only";

import { cookies } from "next/headers";
import {
  CUSTOMER_AUTH_COOKIE_NAME,
  verifyCustomerSessionToken,
} from "@/lib/backend/customerAuth";
import { AUTH_COOKIE_NAME, getSessionFromRequest, verifySessionToken } from "@/lib/backend/sessionAuth";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import {
  IdentityRole,
  readSupabaseSessionFromCookieStore,
  readSupabaseSessionFromRequest,
} from "@/lib/auth/supabaseSession";

export interface CurrentUserRoleContext {
  userId: string | null;
  role: IdentityRole | null;
  email: string | null;
  phone: string | null;
  source: "supabase_cookie_session" | "legacy_admin_session" | "legacy_customer_session" | "none";
}

function normalizeRole(value: unknown): IdentityRole | null {
  if (
    value === "admin" ||
    value === "staff" ||
    value === "customer" ||
    value === "agent" ||
    value === "supplier"
  ) {
    return value;
  }
  return null;
}

function parseCookieFromRequest(req: Request, key: string): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const entries = cookieHeader.split(";").map((part) => part.trim());
  for (const entry of entries) {
    const idx = entry.indexOf("=");
    if (idx < 0) continue;
    const name = entry.slice(0, idx);
    const value = entry.slice(idx + 1);
    if (name === key) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export async function getCurrentUserRole(req?: Request): Promise<CurrentUserRoleContext> {
  const supabaseSession = req
    ? readSupabaseSessionFromRequest(req)
    : readSupabaseSessionFromCookieStore(await cookies());

  if (supabaseSession) {
    const profile = await getIdentityProfileByUserId(supabaseSession.userId);
    const role = normalizeRole(profile?.role) || normalizeRole(supabaseSession.role);
    return {
      userId: supabaseSession.userId || null,
      role,
      email: profile?.email || supabaseSession.email || null,
      phone: profile?.phone || supabaseSession.phone || null,
      source: "supabase_cookie_session",
    };
  }

  if (req) {
    const legacyAdmin = getSessionFromRequest(req);
    if (legacyAdmin?.role === "admin") {
      return {
        userId: `admin:${legacyAdmin.username}`,
        role: "admin",
        email: legacyAdmin.username || null,
        phone: null,
        source: "legacy_admin_session",
      };
    }

    const customerToken = parseCookieFromRequest(req, CUSTOMER_AUTH_COOKIE_NAME);
    const customerSession = customerToken ? verifyCustomerSessionToken(customerToken) : null;
    if (customerSession) {
      return {
        userId: customerSession.id || null,
        role: "customer",
        email: customerSession.email || null,
        phone: customerSession.phone || null,
        source: "legacy_customer_session",
      };
    }
  } else {
    const cookieStore = await cookies();

    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const adminSession = adminToken ? verifySessionToken(adminToken) : null;
    if (adminSession?.role === "admin") {
      return {
        userId: `admin:${adminSession.username}`,
        role: "admin",
        email: adminSession.username || null,
        phone: null,
        source: "legacy_admin_session",
      };
    }

    const customerToken = cookieStore.get(CUSTOMER_AUTH_COOKIE_NAME)?.value;
    const customerSession = customerToken ? verifyCustomerSessionToken(customerToken) : null;
    if (customerSession) {
      return {
        userId: customerSession.id || null,
        role: "customer",
        email: customerSession.email || null,
        phone: customerSession.phone || null,
        source: "legacy_customer_session",
      };
    }
  }

  return {
    userId: null,
    role: null,
    email: null,
    phone: null,
    source: "none",
  };
}
