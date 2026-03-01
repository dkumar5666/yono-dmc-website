import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { type PriceQuoteItemInput, priceQuote } from "@/lib/pricing/engine";
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

function toObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const username = auth.claims?.username;
  if (typeof username === "string" && username.trim()) return username.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
}

function normalizeAppliesTo(value: string): PriceQuoteItemInput["applies_to"] {
  const normalized = safeString(value).toLowerCase();
  if (
    normalized === "hotel" ||
    normalized === "transfer" ||
    normalized === "activity" ||
    normalized === "package" ||
    normalized === "visa" ||
    normalized === "insurance" ||
    normalized === "flight_fee"
  ) {
    return normalized;
  }
  return "package";
}

function parseItemsFromMetadata(metadata: Record<string, unknown> | null): PriceQuoteItemInput[] {
  if (!metadata) return [];
  const candidates = [metadata.items, metadata.line_items, metadata.breakdown];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const rows: PriceQuoteItemInput[] = [];
    for (let index = 0; index < candidate.length; index += 1) {
      const raw = candidate[index];
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const row = raw as Record<string, unknown>;
      const baseCost =
        toNumber(row.base_cost) ??
        toNumber(row.amount) ??
        toNumber(row.total_amount) ??
        toNumber(row.price);
      if (baseCost === null) continue;
      rows.push({
        id: safeString(row.id) || `line-${index + 1}`,
        title: safeString(row.title) || safeString(row.name) || `Line ${index + 1}`,
        applies_to: normalizeAppliesTo(
          safeString(row.applies_to) || safeString(row.type) || safeString(row.item_type) || "package"
        ),
        base_cost: Math.max(0, baseCost),
        destination: safeString(row.destination) || null,
        supplier: safeString(row.supplier) || safeString(row.supplier_name) || null,
        currency: safeString(row.currency) || null,
      });
    }
    if (rows.length) return rows;
  }
  return [];
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

async function resolveQuotation(db: SupabaseRestClient, quoteRef: string): Promise<GenericRow | null> {
  const ref = safeString(quoteRef);
  if (!ref) return null;

  const byId = await safeSelectSingle(
    db,
    "quotations",
    new URLSearchParams({
      select: "*",
      id: `eq.${ref}`,
    })
  );
  if (byId) return byId;

  const byQuoteId = await safeSelectSingle(
    db,
    "quotations",
    new URLSearchParams({
      select: "*",
      quotation_id: `eq.${ref}`,
    })
  );
  if (byQuoteId) return byQuoteId;

  return safeSelectSingle(
    db,
    "quotations",
    new URLSearchParams({
      select: "*",
      quotation_code: `eq.${ref}`,
    })
  );
}

async function resolveLeadDestination(
  db: SupabaseRestClient,
  leadId: string | null
): Promise<string | null> {
  const id = safeString(leadId);
  if (!id) return null;
  const lead = await safeSelectSingle(
    db,
    "leads",
    new URLSearchParams({
      select: "destination_city,destination_country,metadata",
      id: `eq.${id}`,
    })
  );
  if (!lead) return null;
  const city = safeString(lead.destination_city);
  const country = safeString(lead.destination_country);
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  const metadata = toObject(lead.metadata);
  return safeString(metadata?.destination) || null;
}

export async function POST(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const body = (await req.json().catch(() => ({}))) as {
      quote_id?: string;
      quotation_id?: string;
      base_cost?: number;
      destination?: string;
      channel?: "b2c" | "agent";
    };

    const quoteRef =
      safeString(body.quote_id) || safeString(body.quotation_id);
    if (!quoteRef) return routeError(400, "quote_id is required");

    const quotation = await resolveQuotation(db, quoteRef);
    if (!quotation) return routeError(404, "Quotation not found");

    const quotationId = safeString(quotation.id);
    if (!quotationId) return routeError(404, "Quotation not found");

    const existingMetadata = toObject(quotation.metadata) ?? {};
    const itemsFromMeta = parseItemsFromMetadata(existingMetadata);

    const baseCost =
      toNumber(body.base_cost) ??
      toNumber(quotation.base_amount) ??
      toNumber(quotation.net_amount) ??
      toNumber(quotation.amount) ??
      toNumber(quotation.total_amount) ??
      0;

    const destination =
      safeString(body.destination) ||
      safeString(quotation.destination) ||
      safeString(existingMetadata.destination) ||
      (await resolveLeadDestination(db, safeString(quotation.lead_id) || null)) ||
      null;

    const channelRaw =
      safeString(body.channel) ||
      safeString(quotation.channel) ||
      safeString(existingMetadata.channel);
    const channel = channelRaw.toLowerCase() === "agent" ? "agent" : "b2c";

    const priced = await priceQuote(
      {
        base_cost: Math.max(0, baseCost),
        items: itemsFromMeta.length ? itemsFromMeta : undefined,
        destination,
        channel,
        currency:
          safeString(quotation.currency_code) ||
          safeString(quotation.currency) ||
          "INR",
      },
      db
    );

    const pricingMeta = {
      version_id: priced.version?.id ?? null,
      version: priced.version?.version ?? null,
      computed_at: new Date().toISOString(),
      channel: priced.channel,
      destination: priced.destination,
      subtotal: priced.subtotal,
      markup: priced.markup,
      taxes: priced.taxes,
      total: priced.total,
      lines: priced.lines,
    };

    const mergedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      pricing: pricingMeta,
      pricing_last_recalculated_at: pricingMeta.computed_at,
    };

    const updateVariants: Array<Record<string, unknown>> = [
      {
        base_amount: priced.subtotal,
        markup_amount: priced.markup,
        tax_amount: priced.taxes,
        total_amount: priced.total,
        amount: priced.total,
        currency_code: priced.currency,
        metadata: mergedMetadata,
        updated_at: pricingMeta.computed_at,
      },
      {
        total_amount: priced.total,
        amount: priced.total,
        currency_code: priced.currency,
        metadata: mergedMetadata,
        updated_at: pricingMeta.computed_at,
      },
      {
        total_amount: priced.total,
        amount: priced.total,
        updated_at: pricingMeta.computed_at,
      },
      {
        total_amount: priced.total,
        amount: priced.total,
      },
    ];

    let updated: GenericRow | null = null;
    for (const variant of updateVariants) {
      const next = await safeUpdate(
        db,
        "quotations",
        new URLSearchParams({
          id: `eq.${quotationId}`,
        }),
        variant
      );
      if (next) {
        updated = next;
        break;
      }
    }
    if (!updated) return routeError(503, "Failed to update quotation totals");

    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action: "pricing_recalculate_quote",
      entityType: "quotation",
      entityId: quotationId,
      message: "Quotation pricing recalculated",
      meta: {
        actor_username: parseActorUsername(auth),
        version_id: priced.version?.id ?? null,
        version: priced.version?.version ?? null,
        subtotal: priced.subtotal,
        markup: priced.markup,
        taxes: priced.taxes,
        total: priced.total,
      },
    });

    return NextResponse.json({
      ok: true,
      quotation_id: quotationId,
      pricing: {
        version: priced.version,
        subtotal: priced.subtotal,
        markup: priced.markup,
        taxes: priced.taxes,
        total: priced.total,
        currency: priced.currency,
        lines: priced.lines,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return routeError(503, "Supabase is not configured");
    return routeError(500, "Failed to recalculate quotation");
  }
}
