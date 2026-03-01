import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { requireRole } from "@/lib/middleware/requireRole";

type GenericRow = Record<string, unknown>;
type Params = { id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const username = auth.claims?.username;
  if (typeof username === "string" && username.trim()) return username.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
}

async function safeSelectSingle(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<GenericRow | null> {
  try {
    return await db.selectSingle<GenericRow>(table, query);
  } catch {
    return null;
  }
}

async function safeUpdateMany(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.updateSingle<GenericRow>(table, query, payload);
    return true;
  } catch {
    return false;
  }
}

function hasConfirmation(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  return (body as { confirm?: unknown }).confirm === true;
}

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
    if (!hasConfirmation(body)) {
      return routeError(400, "Activation confirmation is required");
    }

    const db = new SupabaseRestClient();
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const id = decodeURIComponent(resolved.id ?? "").trim();
    if (!id) return routeError(404, "Pricing version not found");

    const version = await safeSelectSingle(
      db,
      "pricing_versions",
      new URLSearchParams({
        select: "id,version,status",
        id: `eq.${id}`,
      })
    );
    if (!version) return routeError(404, "Pricing version not found");

    const currentStatus = safeString(version.status).toLowerCase();
    if (currentStatus === "active") {
      return NextResponse.json({
        ok: true,
        version: {
          id: safeString(version.id) || id,
          version: version.version ?? null,
          status: "active",
        },
      });
    }

    await safeUpdateMany(
      db,
      "pricing_versions",
      new URLSearchParams({
        status: "eq.active",
      }),
      {
        status: "archived",
      }
    );

    const activated = await safeUpdateMany(
      db,
      "pricing_versions",
      new URLSearchParams({
        id: `eq.${id}`,
      }),
      {
        status: "active",
      }
    );
    if (!activated) return routeError(503, "Failed to activate pricing version");

    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action: "pricing_version_activated",
      entityType: "pricing_version",
      entityId: id,
      message: "Pricing version activated",
      meta: {
        actor_username: parseActorUsername(auth),
      },
    });

    return NextResponse.json({
      ok: true,
      version: {
        id,
        version: version.version ?? null,
        status: "active",
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return routeError(503, "Supabase is not configured");
    return routeError(500, "Failed to activate pricing version");
  }
}
