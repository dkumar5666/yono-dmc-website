import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { IdentityRole } from "@/lib/auth/supabaseSession";
import { CurrentUserRoleContext, getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";

interface RequirePortalRoleOptions {
  currentPath?: string;
  nextPath?: string;
  loginPath?: string;
  allowUnauthenticatedPaths?: string[];
}

function normalizePath(path: string | null | undefined): string {
  const value = (path ?? "").trim();
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//")) return "";
  return value;
}

function roleHomePath(role: IdentityRole | null): string {
  if (role === "admin") return "/admin/control-center";
  if (role === "staff") return "/admin/control-center";
  if (role === "agent") return "/agent/dashboard";
  if (role === "supplier") return "/supplier/dashboard";
  if (role === "customer") return "/my-trips";
  return "/";
}

function defaultLoginPath(required: IdentityRole): string {
  if (required === "admin" || required === "staff") return "/official-login";
  if (required === "agent") return "/agent/login";
  if (required === "supplier") return "/supplier/login";
  return "/login";
}

async function currentPathFromRequest(): Promise<string> {
  const requestHeaders = await headers();
  const fromCustom = normalizePath(requestHeaders.get("x-yono-pathname"));
  if (fromCustom) return fromCustom;
  const fromUrl = normalizePath(requestHeaders.get("x-invoke-path"));
  if (fromUrl) return fromUrl;
  return "";
}

export async function requirePortalRole(
  required: IdentityRole | IdentityRole[],
  options: RequirePortalRoleOptions = {}
): Promise<CurrentUserRoleContext> {
  const allowed = Array.isArray(required) ? required : [required];
  const path = normalizePath(options.currentPath) || (await currentPathFromRequest());
  const allowAnonymousOn = new Set((options.allowUnauthenticatedPaths ?? []).map(normalizePath));
  const nextPath = normalizePath(options.nextPath) || path || roleHomePath(allowed[0]);
  const loginPath = normalizePath(options.loginPath) || defaultLoginPath(allowed[0]);

  if (path && allowAnonymousOn.has(path)) {
    return getCurrentUserRole();
  }

  const identity = await getCurrentUserRole();
  if (!identity.role) {
    redirect(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
  }

  if (!allowed.includes(identity.role)) {
    redirect(roleHomePath(identity.role));
  }

  return identity;
}
