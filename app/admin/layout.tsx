import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/backend/sessionAuth";
import { readSupabaseSessionFromCookieStore } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import { getAppMode } from "@/lib/config/appMode";
import { requirePortalRole } from "@/lib/auth/requirePortalRole";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-yono-pathname")?.trim() || "";
  await requirePortalRole("admin", {
    currentPath: pathname,
    loginPath: "/official-login",
    allowUnauthenticatedPaths: ["/admin/login", "/official-login", "/official/login"],
    nextPath: pathname || "/admin/control-center",
  });

  const cookieStore = await cookies();
  const supabaseSession = readSupabaseSessionFromCookieStore(cookieStore);
  const profile = supabaseSession ? await getIdentityProfileByUserId(supabaseSession.userId) : null;
  const supabaseRole = profile?.role || supabaseSession?.role;
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const legacySession = token ? verifySessionToken(token) : null;

  const initialUser =
    supabaseSession && (supabaseRole === "admin" || supabaseRole === "staff")
      ? {
          username: supabaseSession.email || profile?.email || supabaseSession.userId,
          role: "admin" as const,
        }
      : legacySession
        ? { username: legacySession.username, role: legacySession.role }
        : null;

  return (
    <AdminLayoutClient initialUser={initialUser} appMode={getAppMode()}>
      {children}
    </AdminLayoutClient>
  );
}
