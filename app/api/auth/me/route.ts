import { NextResponse } from "next/server";
import {
  areAuthUsersConfigured,
  getSessionFromRequest,
} from "@/lib/backend/sessionAuth";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";

export async function GET(req: Request) {
  const supabaseSession = readSupabaseSessionFromRequest(req);
  if (supabaseSession) {
    const profile = await getIdentityProfileByUserId(supabaseSession.userId);
    const role = profile?.role || supabaseSession.role || "customer";
    if (role === "admin" || role === "staff") {
      return NextResponse.json({
        user: {
          username: supabaseSession.email || supabaseSession.userId,
          role,
          authProvider: "supabase",
        },
      });
    }
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    if (!areAuthUsersConfigured()) {
      return NextResponse.json(
        { error: "Auth users are not configured in environment" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: { username: session.username, role: session.role },
  });
}
