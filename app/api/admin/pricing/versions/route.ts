import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { requireRole } from "@/lib/middleware/requireRole";

type GenericRow = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const username = auth.claims?.username;
  if (typeof username === "string" && username.trim()) return username.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
}

async function safeSelectMany<T>(
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

async function safeInsert(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<GenericRow | null> {
  try {
    return await db.insertSingle<GenericRow>(table, payload);
  } catch {
    return null;
  }
}

async function safeInsertLink(
  db: SupabaseRestClient,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.insertSingle<GenericRow>("pricing_rule_versions", payload);
    return true;
  } catch {
    return false;
  }
}

function mapVersion(row: GenericRow, ruleCount: number) {
  return {
    id: safeString(row.id) || null,
    version: Math.floor(toNumber(row.version) ?? 0),
    status: safeString(row.status) || "draft",
    created_at: safeString(row.created_at) || null,
    rule_count: ruleCount,
    rule_preview: [] as string[],
  };
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const versionRows = await safeSelectMany<GenericRow>(
      db,
      "pricing_versions",
      new URLSearchParams({
        select: "id,version,status,created_at",
        order: "version.desc,created_at.desc",
        limit: "200",
      })
    );

    if (!versionRows.length) {
      return NextResponse.json({ rows: [], total: 0, active_version_id: null });
    }

    const linkRows = await safeSelectMany<GenericRow>(
      db,
      "pricing_rule_versions",
      new URLSearchParams({
        select: "version_id,rule_id",
        limit: "5000",
      })
    );
    const countByVersion = new Map<string, number>();
    for (const row of linkRows) {
      const versionId = safeString(row.version_id);
      if (!versionId) continue;
      countByVersion.set(versionId, (countByVersion.get(versionId) ?? 0) + 1);
    }

    const rows = versionRows.map((row) => {
      const id = safeString(row.id);
      return mapVersion(row, id ? countByVersion.get(id) ?? 0 : 0);
    });

    const ruleRows = await safeSelectMany<GenericRow>(
      db,
      "pricing_rules",
      new URLSearchParams({
        select: "id,name",
        limit: "5000",
      })
    );
    const ruleNameById = new Map<string, string>();
    for (const row of ruleRows) {
      const id = safeString(row.id);
      if (!id) continue;
      ruleNameById.set(id, safeString(row.name) || id.slice(0, 8));
    }
    const ruleIdsByVersion = new Map<string, string[]>();
    for (const row of linkRows) {
      const versionId = safeString(row.version_id);
      const ruleId = safeString(row.rule_id);
      if (!versionId || !ruleId) continue;
      const ids = ruleIdsByVersion.get(versionId) ?? [];
      if (!ids.includes(ruleId)) ids.push(ruleId);
      ruleIdsByVersion.set(versionId, ids);
    }
    for (const row of rows) {
      const versionId = safeString(row.id);
      if (!versionId) continue;
      const ruleIds = ruleIdsByVersion.get(versionId) ?? [];
      row.rule_preview = ruleIds.slice(0, 5).map((id) => ruleNameById.get(id) ?? id);
    }

    const active = rows.find((row) => safeString(row.status).toLowerCase() === "active");
    return NextResponse.json({
      rows,
      total: rows.length,
      active_version_id: active?.id ?? null,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0, active_version_id: null });
    }
    return NextResponse.json({ rows: [], total: 0, active_version_id: null });
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const body = (await req.json().catch(() => ({}))) as { clone_from_id?: string };
    const cloneFromId = safeString(body.clone_from_id);

    const versions = await safeSelectMany<GenericRow>(
      db,
      "pricing_versions",
      new URLSearchParams({
        select: "id,version,status",
        order: "version.desc,created_at.desc",
        limit: "200",
      })
    );
    const maxVersion = versions.reduce((acc, row) => {
      const version = Math.floor(toNumber(row.version) ?? 0);
      return version > acc ? version : acc;
    }, 0);

    const activeVersion =
      versions.find((row) => safeString(row.status).toLowerCase() === "active") ?? null;
    const sourceVersionId = cloneFromId || safeString(activeVersion?.id);

    const inserted = await safeInsert(db, "pricing_versions", {
      version: maxVersion + 1,
      status: "draft",
    });
    if (!inserted || !safeString(inserted.id)) {
      return routeError(503, "Pricing versions table unavailable");
    }
    const newVersionId = safeString(inserted.id);

    if (sourceVersionId) {
      const sourceLinks = await safeSelectMany<GenericRow>(
        db,
        "pricing_rule_versions",
        new URLSearchParams({
          select: "rule_id",
          version_id: `eq.${sourceVersionId}`,
          limit: "5000",
        })
      );
      for (const row of sourceLinks) {
        const ruleId = safeString(row.rule_id);
        if (!ruleId) continue;
        await safeInsertLink(db, {
          version_id: newVersionId,
          rule_id: ruleId,
        });
      }
    }

    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action: "pricing_version_created",
      entityType: "pricing_version",
      entityId: newVersionId,
      message: "Pricing version created",
      meta: {
        actor_username: parseActorUsername(auth),
        clone_from_id: sourceVersionId || null,
        version: Math.floor(toNumber(inserted.version) ?? 0),
      },
    });

    return NextResponse.json({
      ok: true,
      version: {
        id: newVersionId,
        version: Math.floor(toNumber(inserted.version) ?? maxVersion + 1),
        status: safeString(inserted.status) || "draft",
        created_at: safeString(inserted.created_at) || null,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return routeError(503, "Supabase is not configured");
    return routeError(500, "Failed to create pricing version");
  }
}
