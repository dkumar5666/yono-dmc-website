import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

type GenericRow = Record<string, unknown>;

export type PricingRuleType = "percent" | "fixed";
export type PricingAppliesTo =
  | "hotel"
  | "transfer"
  | "activity"
  | "package"
  | "visa"
  | "insurance"
  | "flight_fee";

export interface PricingRule {
  id: string;
  name: string;
  applies_to: PricingAppliesTo;
  destination: string | null;
  supplier: string | null;
  rule_type: PricingRuleType;
  value: number;
  currency: string;
  priority: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string | null;
}

export interface PricingVersion {
  id: string;
  version: number;
  status: "draft" | "active" | "archived";
  created_at: string | null;
}

export interface PriceQuoteItemInput {
  id?: string | null;
  title?: string | null;
  applies_to: PricingAppliesTo;
  base_cost: number;
  destination?: string | null;
  supplier?: string | null;
  currency?: string | null;
}

export interface PriceQuoteInput {
  base_cost: number;
  items?: PriceQuoteItemInput[];
  destination?: string | null;
  supplier?: string | null;
  channel?: "b2c" | "agent";
  currency?: string | null;
  at?: string | Date | null;
}

export interface PriceLine {
  id: string;
  title: string;
  applies_to: PricingAppliesTo;
  base_cost: number;
  currency: string;
  markup: number;
  tax: number;
  total: number;
  rule_id: string | null;
  rule_name: string | null;
  rule_type: PricingRuleType | null;
  rule_value: number | null;
}

export interface PriceQuoteResult {
  version: PricingVersion | null;
  subtotal: number;
  markup: number;
  taxes: number;
  total: number;
  currency: string;
  channel: "b2c" | "agent";
  destination: string | null;
  lines: PriceLine[];
}

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

function isPricingAppliesTo(value: string): value is PricingAppliesTo {
  return ["hotel", "transfer", "activity", "package", "visa", "insurance", "flight_fee"].includes(value);
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = safeString(value).toUpperCase();
  return normalized || "INR";
}

function normalizeText(value: string | null | undefined): string {
  return safeString(value).toLowerCase();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function nowIso(input: PriceQuoteInput["at"]): Date {
  if (input instanceof Date && Number.isFinite(input.getTime())) return input;
  if (typeof input === "string") {
    const date = new Date(input);
    if (Number.isFinite(date.getTime())) return date;
  }
  return new Date();
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

function mapVersionRow(row: GenericRow): PricingVersion | null {
  const id = safeString(row.id);
  const version = toNumber(row.version);
  const status = safeString(row.status).toLowerCase();
  if (!id || version === null) return null;
  if (status !== "draft" && status !== "active" && status !== "archived") return null;
  return {
    id,
    version: Math.floor(version),
    status,
    created_at: safeString(row.created_at) || null,
  };
}

function mapRuleRow(row: GenericRow): PricingRule | null {
  const id = safeString(row.id);
  const appliesTo = safeString(row.applies_to).toLowerCase();
  const ruleType = safeString(row.rule_type).toLowerCase();
  const value = toNumber(row.value);
  if (!id || !isPricingAppliesTo(appliesTo)) return null;
  if (ruleType !== "percent" && ruleType !== "fixed") return null;
  if (value === null) return null;
  return {
    id,
    name: safeString(row.name) || `Rule ${id.slice(0, 8)}`,
    applies_to: appliesTo,
    destination: safeString(row.destination) || null,
    supplier: safeString(row.supplier) || null,
    rule_type: ruleType,
    value,
    currency: normalizeCurrency(safeString(row.currency) || null),
    priority: Math.floor(toNumber(row.priority) ?? 100),
    active: row.active !== false,
    valid_from: safeString(row.valid_from) || null,
    valid_to: safeString(row.valid_to) || null,
    created_at: safeString(row.created_at) || null,
  };
}

export async function getActivePricingVersion(db?: SupabaseRestClient): Promise<PricingVersion | null> {
  try {
    const client = db ?? new SupabaseRestClient();
    const rows = await safeSelectMany<GenericRow>(
      client,
      "pricing_versions",
      new URLSearchParams({
        select: "id,version,status,created_at",
        status: "eq.active",
        order: "version.desc,created_at.desc",
        limit: "1",
      })
    );
    const mapped = rows.map(mapVersionRow).filter((row): row is PricingVersion => Boolean(row));
    if (mapped.length > 0) return mapped[0];

    // fallback for environments where status might not exist yet
    const fallbackRows = await safeSelectMany<GenericRow>(
      client,
      "pricing_versions",
      new URLSearchParams({
        select: "id,version,status,created_at",
        order: "version.desc,created_at.desc",
        limit: "1",
      })
    );
    return fallbackRows.map(mapVersionRow).find(Boolean) ?? null;
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    return null;
  }
}

async function loadActiveRules(
  db: SupabaseRestClient,
  version: PricingVersion | null
): Promise<PricingRule[]> {
  const ruleRows = await safeSelectMany<GenericRow>(
    db,
    "pricing_rules",
    new URLSearchParams({
      select:
        "id,name,applies_to,destination,supplier,rule_type,value,currency,priority,active,valid_from,valid_to,created_at",
      active: "eq.true",
      order: "priority.asc,created_at.asc",
      limit: "1000",
    })
  );
  const allRules = ruleRows.map(mapRuleRow).filter((row): row is PricingRule => Boolean(row));
  if (!version || allRules.length === 0) return allRules;

  const links = await safeSelectMany<GenericRow>(
    db,
    "pricing_rule_versions",
    new URLSearchParams({
      select: "rule_id",
      version_id: `eq.${version.id}`,
      limit: "2000",
    })
  );
  if (!links.length) return allRules;
  const ruleIds = new Set(
    links.map((row) => safeString(row.rule_id)).filter(Boolean)
  );
  const linked = allRules.filter((rule) => ruleIds.has(rule.id));
  return linked.length ? linked : allRules;
}

function isRuleValidAt(rule: PricingRule, at: Date): boolean {
  if (!rule.active) return false;
  if (rule.valid_from) {
    const from = new Date(rule.valid_from);
    if (Number.isFinite(from.getTime()) && at < from) return false;
  }
  if (rule.valid_to) {
    const to = new Date(rule.valid_to);
    if (Number.isFinite(to.getTime()) && at > to) return false;
  }
  return true;
}

function pickRuleForItem(
  rules: PricingRule[],
  item: PriceQuoteItemInput,
  context: { destination: string | null; supplier: string | null; at: Date }
): PricingRule | null {
  const destination = normalizeText(item.destination || context.destination);
  const supplier = normalizeText(item.supplier || context.supplier);

  for (const rule of rules) {
    if (rule.applies_to !== item.applies_to) continue;
    if (!isRuleValidAt(rule, context.at)) continue;

    const ruleDestination = normalizeText(rule.destination);
    if (ruleDestination && destination && ruleDestination !== destination) continue;
    if (ruleDestination && !destination) continue;

    const ruleSupplier = normalizeText(rule.supplier);
    if (ruleSupplier && supplier && ruleSupplier !== supplier) continue;
    if (ruleSupplier && !supplier) continue;

    return rule;
  }
  return null;
}

export async function priceQuote(input: PriceQuoteInput, db?: SupabaseRestClient): Promise<PriceQuoteResult> {
  const channel: "b2c" | "agent" = input.channel === "agent" ? "agent" : "b2c";
  const destination = safeString(input.destination) || null;
  const supplier = safeString(input.supplier) || null;
  const currency = normalizeCurrency(input.currency);
  const at = nowIso(input.at);

  const normalizedBase = Math.max(0, toNumber(input.base_cost) ?? 0);
  const items: PriceQuoteItemInput[] =
    Array.isArray(input.items) && input.items.length > 0
      ? input.items
          .map((item, index) => ({
            id: safeString(item.id) || `item-${index + 1}`,
            title: safeString(item.title) || `Line ${index + 1}`,
            applies_to: item.applies_to,
            base_cost: Math.max(0, toNumber(item.base_cost) ?? 0),
            destination: safeString(item.destination) || null,
            supplier: safeString(item.supplier) || null,
            currency: normalizeCurrency(item.currency || currency),
          }))
          .filter((item) => item.base_cost >= 0)
      : [
          {
            id: "line-1",
            title: "Package",
            applies_to: "package",
            base_cost: normalizedBase,
            destination,
            supplier,
            currency,
          },
        ];

  try {
    const client = db ?? new SupabaseRestClient();
    const version = await getActivePricingVersion(client);
    const rules = await loadActiveRules(client, version);

    let subtotal = 0;
    let markup = 0;
    let taxes = 0;
    const lines: PriceLine[] = [];

    for (const item of items) {
      subtotal += item.base_cost;
      const rule = pickRuleForItem(rules, item, {
        destination,
        supplier,
        at,
      });

      let lineMarkup = 0;
      if (rule) {
        if (rule.rule_type === "percent") {
          lineMarkup = (item.base_cost * rule.value) / 100;
        } else {
          lineMarkup = rule.value;
        }
      }
      lineMarkup = Math.max(0, round2(lineMarkup));
      const lineTax = 0;
      const lineTotal = round2(item.base_cost + lineMarkup + lineTax);
      markup += lineMarkup;
      taxes += lineTax;

      lines.push({
        id: safeString(item.id) || randomLineId(),
        title: safeString(item.title) || "Line",
        applies_to: item.applies_to,
        base_cost: round2(item.base_cost),
        currency: normalizeCurrency(item.currency || currency),
        markup: lineMarkup,
        tax: lineTax,
        total: lineTotal,
        rule_id: rule?.id ?? null,
        rule_name: rule?.name ?? null,
        rule_type: rule?.rule_type ?? null,
        rule_value: rule?.value ?? null,
      });
    }

    subtotal = round2(subtotal);
    markup = round2(markup);
    taxes = round2(taxes);
    const total = round2(subtotal + markup + taxes);

    return {
      version,
      subtotal,
      markup,
      taxes,
      total,
      currency,
      channel,
      destination,
      lines,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return {
        version: null,
        subtotal: round2(normalizedBase),
        markup: 0,
        taxes: 0,
        total: round2(normalizedBase),
        currency,
        channel,
        destination,
        lines: [
          {
            id: "line-1",
            title: "Package",
            applies_to: "package",
            base_cost: round2(normalizedBase),
            currency,
            markup: 0,
            tax: 0,
            total: round2(normalizedBase),
            rule_id: null,
            rule_name: null,
            rule_type: null,
            rule_value: null,
          },
        ],
      };
    }
    return {
      version: null,
      subtotal: round2(normalizedBase),
      markup: 0,
      taxes: 0,
      total: round2(normalizedBase),
      currency,
      channel,
      destination,
      lines: [
        {
          id: "line-1",
          title: "Package",
          applies_to: "package",
          base_cost: round2(normalizedBase),
          currency,
          markup: 0,
          tax: 0,
          total: round2(normalizedBase),
          rule_id: null,
          rule_name: null,
          rule_type: null,
          rule_value: null,
        },
      ],
    };
  }
}

function randomLineId(): string {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}
