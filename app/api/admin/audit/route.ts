import { NextResponse } from "next/server";
import { writeAdminAuditLog, readAdminAuditLogs } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toMetaObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parseLimit(value: string | null, fallback = 20, max = 100): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const url = new URL(req.url);
    const entityType = safeString(url.searchParams.get("entity_type"));
    const entityId = safeString(url.searchParams.get("entity_id"));
    const limit = parseLimit(url.searchParams.get("limit"), 20, 100);

    if (!entityType || !entityId) {
      return NextResponse.json({ ok: true, rows: [] });
    }

    const db = new SupabaseRestClient();
    const rows = await readAdminAuditLogs(db, { entityType, entityId, limit });
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ ok: true, rows: [] });
    }
    return routeError(500, "Failed to load audit logs");
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = safeString(body.action);
    const entityType = safeString(body.entity_type);
    const entityId = safeString(body.entity_id);
    const message = safeString(body.message);
    const metaFromBody = toMetaObject(body.meta);

    if (!action || !entityType || !entityId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required audit fields",
        },
        { status: 400 }
      );
    }

    const db = new SupabaseRestClient();
    const mergedMeta: Record<string, unknown> = {
      ...(metaFromBody ?? {}),
      actor_role: auth.role ?? "admin",
      actor_user_id: auth.userId ?? null,
    };

    if (typeof auth.claims.username === "string" && auth.claims.username.trim()) {
      mergedMeta.actor_username = auth.claims.username;
    }

    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action,
      entityType,
      entityId,
      message: message || undefined,
      meta: mergedMeta,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ ok: true });
    }
    return routeError(500, "Failed to write audit log");
  }
}
