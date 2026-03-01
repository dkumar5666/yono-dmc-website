import { NextResponse } from "next/server";
import {
  AuthRole,
  extractBearerToken,
  getUserRoleFromJWT,
} from "@/lib/auth/getUserRoleFromJWT";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getSessionFromRequest } from "@/lib/backend/sessionAuth";
import { routeError } from "@/lib/middleware/routeError";

type AllowedRoles = AuthRole | AuthRole[];

function normalizeAllowed(allowed: AllowedRoles): AuthRole[] {
  const base = Array.isArray(allowed) ? allowed : [allowed];
  if (base.includes("admin") && !base.includes("staff")) {
    return [...base, "staff"];
  }
  return base;
}

export interface RequireRoleResult {
  denied: NextResponse | null;
  role: AuthRole | null;
  userId: string | null;
  claims: Record<string, unknown>;
}

/**
 * Protects API routes using JWT role claim.
 *
 * Expected header:
 * Authorization: Bearer <supabase_access_token>
 */
export function requireRole(req: Request, allowed: AllowedRoles): RequireRoleResult {
  const required = normalizeAllowed(allowed);
  const token = extractBearerToken(req);
  if (!token) {
    const supabaseSession = readSupabaseSessionFromRequest(req);
    const supabaseRole = (supabaseSession?.role || null) as AuthRole | null;
    if (supabaseSession && supabaseRole) {
      if (required.includes(supabaseRole)) {
        return {
          denied: null,
          role: supabaseRole,
          userId: supabaseSession.userId,
          claims: {
            auth_provider: "supabase_cookie_session",
            role: supabaseRole,
          },
        };
      }
      return {
        denied: routeError(403, "Not authorized"),
        role: supabaseRole,
        userId: supabaseSession.userId,
        claims: {
          auth_provider: "supabase_cookie_session",
          role: supabaseRole,
        },
      };
    }

    // Backward-compatible bridge for existing /admin UI which still authenticates
    // via signed session cookie (not Supabase JWT). Only allow this path for admin
    // protected routes so customer/supplier APIs remain JWT-only.
    if (required.includes("admin")) {
      const legacySession = getSessionFromRequest(req);
      if (legacySession?.role === "admin") {
        return {
          denied: null,
          role: "admin",
          userId: `admin:${legacySession.username}`,
          claims: {
            auth_provider: "legacy_admin_session",
            username: legacySession.username,
          },
        };
      }
      if (legacySession?.role === "editor") {
        return {
          denied: routeError(403, "Not authorized"),
          role: null,
          userId: `editor:${legacySession.username}`,
          claims: {
            auth_provider: "legacy_admin_session",
            username: legacySession.username,
            legacy_role: "editor",
          },
        };
      }
    }

    return {
      denied: routeError(401, "Not authenticated"),
      role: null,
      userId: null,
      claims: {},
    };
  }

  const context = getUserRoleFromJWT(token);
  if (!context.verified) {
    return {
      denied: routeError(401, "Not authenticated"),
      role: null,
      userId: context.userId,
      claims: context.claims,
    };
  }

  if (!context.role || !required.includes(context.role)) {
    return {
      denied: routeError(403, "Not authorized"),
      role: context.role,
      userId: context.userId,
      claims: context.claims,
    };
  }

  return {
    denied: null,
    role: context.role,
    userId: context.userId,
    claims: context.claims,
  };
}
