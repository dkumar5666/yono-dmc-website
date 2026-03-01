import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { requireRole } from "@/lib/middleware/requireRole";

type GenericRow = Record<string, unknown>;
type Params = { id: string };

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

async function safeUpdate(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams,
  payload: Record<string, unknown>
): Promise<GenericRow | null> {
  try {
    return await db.updateSingle<GenericRow>(table, query, payload);
  } catch {
    return null;
  }
}

function mapRule(row: GenericRow | null) {
  if (!row) return null;
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

export async function GET(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const id = decodeURIComponent(resolved.id ?? "").trim();
    if (!id) return NextResponse.json({ rule: null }, { status: 404 });

    const row = await safeSelectSingle(
      db,
      "pricing_rules",
      new URLSearchParams({
        select:
          "id,name,applies_to,destination,supplier,rule_type,value,currency,priority,active,valid_from,valid_to,created_at",
        id: `eq.${id}`,
      })
    );
    if (!row) return NextResponse.json({ rule: null }, { status: 404 });
    return NextResponse.json({ rule: mapRule(row) });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return NextResponse.json({ rule: null }, { status: 404 });
    return routeError(500, "Failed to load pricing rule");
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const id = decodeURIComponent(resolved.id ?? "").trim();
    if (!id) return routeError(404, "Pricing rule not found");

    const existing = await safeSelectSingle(
      db,
      "pricing_rules",
      new URLSearchParams({
        select: "id,name",
        id: `eq.${id}`,
      })
    );
    if (!existing) return routeError(404, "Pricing rule not found");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.name === "string") payload.name = safeString(body.name);
    if (typeof body.applies_to === "string") {
      const appliesTo = safeString(body.applies_to).toLowerCase();
      if (!ALLOWED_APPLIES_TO.has(appliesTo)) return routeError(400, "Invalid applies_to");
      payload.applies_to = appliesTo;
    }
    if (typeof body.rule_type === "string") {
      const ruleType = safeString(body.rule_type).toLowerCase();
      if (!ALLOWED_RULE_TYPES.has(ruleType)) return routeError(400, "Invalid rule_type");
      payload.rule_type = ruleType;
    }
    if (body.value !== undefined) {
      const value = toNumber(body.value);
      if (value === null) return routeError(400, "Invalid rule value");
      payload.value = value;
    }
    if (body.priority !== undefined) {
      const priority = toNumber(body.priority);
      if (priority === null) return routeError(400, "Invalid priority");
      payload.priority = Math.floor(priority);
    }
    if (body.active !== undefined) payload.active = body.active === true;
    if (typeof body.destination === "string" || body.destination === null) {
      payload.destination = body.destination === null ? null : safeString(body.destination);
    }
    if (typeof body.supplier === "string" || body.supplier === null) {
      payload.supplier = body.supplier === null ? null : safeString(body.supplier);
    }
    if (typeof body.currency === "string") payload.currency = safeString(body.currency).toUpperCase() || "INR";
    if (typeof body.valid_from === "string" || body.valid_from === null) payload.valid_from = body.valid_from || null;
    if (typeof body.valid_to === "string" || body.valid_to === null) payload.valid_to = body.valid_to || null;

    const updated = await safeUpdate(
      db,
      "pricing_rules",
      new URLSearchParams({
        id: `eq.${id}`,
      }),
      payload
    );
    if (!updated) return routeError(503, "Pricing rule update unavailable");

    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action: "pricing_rule_updated",
      entityType: "pricing_rule",
      entityId: id,
      message: "Pricing rule updated",
      meta: {
        actor_username: parseActorUsername(auth),
        updated_fields: Object.keys(payload),
      },
    });

    return NextResponse.json({ ok: true, rule: mapRule(updated) });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return routeError(503, "Supabase is not configured");
    return routeError(500, "Failed to update pricing rule");
  }
}
