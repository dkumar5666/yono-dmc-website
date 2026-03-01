import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { requireRole } from "@/lib/middleware/requireRole";

type GenericRow = Record<string, unknown>;

const ALLOWED_APPLIES_TO = new Set([
  "hotel",
  "transfer",
  "activity",
  "package",
  "visa",
  "insurance",
  "flight_fee",
]);
const ALLOWED_RULE_TYPES = new Set(["percent", "fixed"]);

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

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function parseBoolean(value: string | null): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
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

function mapRule(row: GenericRow): Record<string, unknown> {
  return {
    id: safeString(row.id) || null,
    name: safeString(row.name) || null,
    applies_to: safeString(row.applies_to) || null,
    destination: safeString(row.destination) || null,
    supplier: safeString(row.supplier) || null,
    rule_type: safeString(row.rule_type) || null,
    value: toNumber(row.value),
    currency: safeString(row.currency) || "INR",
    priority: Math.floor(toNumber(row.priority) ?? 100),
    active: row.active !== false,
    valid_from: safeString(row.valid_from) || null,
    valid_to: safeString(row.valid_to) || null,
    created_at: safeString(row.created_at) || null,
  };
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const query = new URLSearchParams({
      select:
        "id,name,applies_to,destination,supplier,rule_type,value,currency,priority,active,valid_from,valid_to,created_at",
      order: "priority.asc,created_at.desc",
      limit: String(limit),
      offset: String(offset),
    });

    const appliesTo = safeString(url.searchParams.get("applies_to"));
    if (appliesTo) query.set("applies_to", `eq.${appliesTo}`);

    const destination = safeString(url.searchParams.get("destination"));
    if (destination) query.set("destination", `ilike.%${destination}%`);

    const active = parseBoolean(url.searchParams.get("active"));
    if (active !== null) query.set("active", `eq.${active}`);

    const rows = await safeSelectMany<GenericRow>(db, "pricing_rules", query);
    const mapped = rows.map(mapRule);

    let total = mapped.length;
    try {
      const totalRows = await db.selectMany<GenericRow>(
        "pricing_rules",
        new URLSearchParams({
          select: "id",
          limit: "1000",
        })
      );
      total = Array.isArray(totalRows) ? totalRows.length : mapped.length;
    } catch {
      total = mapped.length;
    }

    return NextResponse.json({
      rows: mapped,
      total,
      limit,
      offset,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0, limit: 50, offset: 0 });
    }
    return NextResponse.json({ rows: [], total: 0, limit: 50, offset: 0 });
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = safeString(body.name);
    const appliesTo = safeString(body.applies_to).toLowerCase();
    const ruleType = safeString(body.rule_type).toLowerCase();
    const value = toNumber(body.value);
    if (!name) return routeError(400, "Rule name is required");
    if (!ALLOWED_APPLIES_TO.has(appliesTo)) return routeError(400, "Invalid applies_to");
    if (!ALLOWED_RULE_TYPES.has(ruleType)) return routeError(400, "Invalid rule_type");
    if (value === null) return routeError(400, "Rule value is required");

    const payload: Record<string, unknown> = {
      name,
      applies_to: appliesTo,
      destination: safeString(body.destination) || null,
      supplier: safeString(body.supplier) || null,
      rule_type: ruleType,
      value,
      currency: safeString(body.currency).toUpperCase() || "INR",
      priority: Math.floor(toNumber(body.priority) ?? 100),
      active: body.active !== false,
      valid_from: safeString(body.valid_from) || null,
      valid_to: safeString(body.valid_to) || null,
    };

    const inserted = await safeInsert(db, "pricing_rules", payload);
    if (!inserted) return routeError(503, "Pricing rules table unavailable");
    const insertedRuleId = safeString(inserted.id);

    if (insertedRuleId) {
      const activeVersion = await safeSelectSingle(
        db,
        "pricing_versions",
        new URLSearchParams({
          select: "id",
          status: "eq.active",
          order: "version.desc,created_at.desc",
          limit: "1",
        })
      );
      const activeVersionId = safeString(activeVersion?.id);
      if (activeVersionId) {
        await safeInsert(db, "pricing_rule_versions", {
          version_id: activeVersionId,
          rule_id: insertedRuleId,
        });
      }
    }

    const actorUsername = parseActorUsername(auth);
    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action: "pricing_rule_created",
      entityType: "pricing_rule",
      entityId: insertedRuleId || name,
      message: "Pricing rule created",
      meta: {
        actor_username: actorUsername,
        applies_to: appliesTo,
        rule_type: ruleType,
        value,
      },
    });

    return NextResponse.json({ ok: true, rule: mapRule(inserted) }, { status: 201 });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(503, "Supabase is not configured");
    }
    return routeError(500, "Failed to create pricing rule");
  }
}
