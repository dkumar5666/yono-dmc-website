import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/backend/sessionAuth";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;

  const initialUser = session
    ? { username: session.username, role: session.role }
    : null;

  return <AdminLayoutClient initialUser={initialUser}>{children}</AdminLayoutClient>;
}
