import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  resolveAttractionCountry,
  ticketedAttractionCountries as seedCountries,
  ticketedAttractions as seedAttractions,
  type AttractionCategory,
  type AttractionCountry,
  type TicketedAttraction,
} from "@/data/ticketedAttractions";
import { siteConfig } from "@/data/site";

interface AttractionsData {
  attractions: TicketedAttraction[];
  updatedAt: string;
}

interface AttractionsInput {
  attractions?: Array<Partial<TicketedAttraction> & Record<string, unknown>>;
}

const runtimeDir = path.join(process.cwd(), ".runtime");
const attractionsFile = path.join(runtimeDir, "attractions.json");

const allowedCategories: AttractionCategory[] = [
  "Observation & Landmark",
  "Theme Park",
  "Museum & Culture",
  "Nature & Wildlife",
  "Cruise & Tour",
  "Adventure",
];

const defaultByCountry = new Map(
  seedCountries.map((country) => [country.key, country] as const)
);

const defaultByCountryName = new Map(
  seedCountries.map((country) => [normalize(country.name), country] as const)
);

const seedBySlug = new Map(seedAttractions.map((item) => [item.slug, item] as const));
const seedByCountryTitle = new Map(
  seedAttractions.map((item) => [
    `${item.countryKey}::${normalize(item.title)}`,
    item,
  ] as const)
);

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toStringValue(value: unknown, fallback = ""): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function toNumberValue(value: unknown, fallback: number): number {
  const n = Number(value ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => toStringValue(item)).filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }

  const text = toStringValue(value);
  if (!text) return fallback;
  const parts = text
    .split(/\||,|\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : fallback;
}

function inferCategory(title: string): AttractionCategory {
  const value = title.toLowerCase();
  if (/(theme park|waterpark|universal studios|disney|warner|legoland|everland|lotte world|dreamworld|movie world)/.test(value)) return "Theme Park";
  if (/(museum|palace|temple|fort|castle|citadel|mausoleum|sanctuary|mosque|city|tomb)/.test(value)) return "Museum & Culture";
  if (/(zoo|wildlife|aquarium|marine|dolphin|safari|national park|nature park|forest)/.test(value)) return "Nature & Wildlife";
  if (/(cruise|ferry|tour|boat|island|railway)/.test(value)) return "Cruise & Tour";
  if (/(balloon|paragliding|coaster|ropeway|cable car|adventure|permit|walk|hike)/.test(value)) return "Adventure";
  return "Observation & Landmark";
}

function inferDuration(category: AttractionCategory): string {
  if (category === "Theme Park") return "Full Day";
  if (category === "Cruise & Tour") return "2-8 Hours";
  if (category === "Adventure") return "1-5 Hours";
  return "1-3 Hours";
}

function inferTiming(category: AttractionCategory): string {
  if (category === "Theme Park") return "10:00 AM - 8:00 PM (varies by venue)";
  if (category === "Cruise & Tour") return "Multiple daily departures";
  if (category === "Adventure") return "Morning and evening slots";
  return "Daily opening hours vary by attraction";
}

function buildHighlights(category: AttractionCategory, countryName: string): string[] {
  if (category === "Theme Park") {
    return [
      "Entry to major rides and entertainment zones",
      "Best for families and first-time travelers",
      `Popular pick in ${countryName}`,
    ];
  }
  if (category === "Museum & Culture") {
    return [
      "Heritage and cultural significance",
      "Great for guided city itineraries",
      "Photo-friendly iconic location",
    ];
  }
  if (category === "Nature & Wildlife") {
    return [
      "Close-up nature and wildlife experiences",
      "Suitable for family and group travel",
      "Easy add-on with city sightseeing",
    ];
  }
  if (category === "Cruise & Tour") {
    return [
      "Scenic city and coastal perspectives",
      "Flexible day and evening options",
      "Comfortable for couples and families",
    ];
  }
  if (category === "Adventure") {
    return [
      "High-engagement experience with trained operators",
      "Safety-led operating procedures",
      "Ideal for thrill-seeking travelers",
    ];
  }
  return [
    "Landmark experience in prime tourist area",
    "Fast booking and confirmed slots",
    "Suitable for all traveler types",
  ];
}

function buildInclusions(category: AttractionCategory): string[] {
  const base = [
    "Standard admission as per selected option",
    "E-ticket or voucher delivery support",
    "Pre-travel coordination by Yono DMC team",
  ];

  if (category === "Cruise & Tour") {
    return [...base, "Shared transfer support on selected options"];
  }
  return base;
}

function buildExclusions(): string[] {
  return [
    "Personal expenses",
    "Meals unless mentioned",
    "Hotel pickup unless selected",
    "Travel insurance",
  ];
}

function buildCancellationPolicy(category: AttractionCategory): string {
  if (category === "Theme Park") {
    return "Theme park and date-based tickets are often non-refundable after issuance. Reschedule is subject to venue policy.";
  }
  if (category === "Adventure") {
    return "Free cancellation up to 48-72 hours before slot, depending on supplier and weather conditions.";
  }
  return "Free cancellation up to 24-48 hours before activity start time, subject to supplier terms.";
}

function buildTicketsHref(title: string, countryName: string): string {
  const phone = siteConfig.contact.whatsapp.replace(/\D/g, "");
  const text = `Hi Yono DMC, I want tickets for ${title} in ${countryName}. Please share best available price and timing.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function resolveCountryMeta(
  input: Partial<TicketedAttraction> & Record<string, unknown>,
  fallbackTitle: string
): AttractionCountry {
  const rawCountryKey = toStringValue(input.countryKey);
  const rawCountryName =
    toStringValue(input.countryName) ||
    toStringValue(input.country) ||
    toStringValue(input.destination);

  const byKey = defaultByCountry.get(rawCountryKey);
  if (byKey) return byKey;

  if (rawCountryName) {
    const byName = defaultByCountryName.get(normalize(rawCountryName));
    if (byName) return byName;

    const resolved = resolveAttractionCountry(rawCountryName);
    if (resolved) return resolved;

    return {
      key: slugify(rawCountryName) || "custom-country",
      name: rawCountryName,
      tagline: `${rawCountryName} top experiences`,
      cities: [rawCountryName],
    };
  }

  const fallbackResolved = resolveAttractionCountry(fallbackTitle);
  if (fallbackResolved) return fallbackResolved;

  return {
    key: "uae",
    name: "United Arab Emirates",
    tagline: "Luxury, Skyscrapers & Desert Adventures",
    cities: ["Dubai", "Abu Dhabi", "Sharjah"],
  };
}

function normalizeAttractionRecord(
  input: Partial<TicketedAttraction> & Record<string, unknown>,
  index: number,
  usedSlugs: Set<string>
): TicketedAttraction | null {
  const title = toStringValue(input.title || input.name);
  if (!title) return null;

  const country = resolveCountryMeta(input, title);
  const requestedSlug = toStringValue(input.slug);
  const baseSlug = requestedSlug || `${country.key}-${slugify(title)}`;
  let slug = slugify(baseSlug) || `${country.key}-attraction-${index + 1}`;
  let duplicateCount = 2;
  while (usedSlugs.has(slug)) {
    slug = `${slugify(baseSlug)}-${duplicateCount}`;
    duplicateCount += 1;
  }
  usedSlugs.add(slug);

  const lookupBase =
    seedBySlug.get(slug) ??
    seedByCountryTitle.get(`${country.key}::${normalize(title)}`);

  const categoryRaw = toStringValue(input.category);
  const category = allowedCategories.includes(categoryRaw as AttractionCategory)
    ? (categoryRaw as AttractionCategory)
    : lookupBase?.category ?? inferCategory(title);

  const rating = toNumberValue(
    input.rating,
    lookupBase?.rating ?? Number((4.2 + (hashCode(`${country.key}-${title}`) % 80) / 100).toFixed(2))
  );
  const reviews = Math.max(
    0,
    Math.floor(
      toNumberValue(
        input.reviews,
        lookupBase?.reviews ?? 100 + (hashCode(`${country.key}-${title}-reviews`) % 25000)
      )
    )
  );

  const cities = toStringArray(input.cities, lookupBase?.cities ?? country.cities);
  const location = toStringValue(input.location, lookupBase?.location ?? country.name);

  const highlights = toStringArray(input.highlights, lookupBase?.highlights ?? buildHighlights(category, country.name));
  const inclusions = toStringArray(input.inclusions, lookupBase?.inclusions ?? buildInclusions(category));
  const exclusions = toStringArray(input.exclusions, lookupBase?.exclusions ?? buildExclusions());

  return {
    id: toStringValue(input.id, lookupBase?.id || `${country.key}-${index + 1}-${crypto.randomUUID().slice(0, 8)}`),
    slug,
    title,
    countryKey: country.key,
    countryName: country.name,
    tagline: toStringValue(input.tagline, lookupBase?.tagline ?? country.tagline),
    cities,
    location,
    image: toStringValue(input.image || input.image_url, lookupBase?.image ?? `/api/images/${slug}`),
    rating: Number(Math.max(1, Math.min(5, rating)).toFixed(2)),
    reviews,
    category,
    duration: toStringValue(input.duration, lookupBase?.duration ?? inferDuration(category)),
    timing: toStringValue(input.timing, lookupBase?.timing ?? inferTiming(category)),
    description: toStringValue(
      input.description,
      lookupBase?.description ||
        `${title} is a highly requested ticketed attraction in ${country.name}. Yono DMC helps you secure availability, pricing guidance, and a smooth booking process for this experience.`
    ),
    highlights,
    inclusions,
    exclusions,
    cancellationPolicy: toStringValue(
      input.cancellationPolicy || input.cancellation_policy,
      lookupBase?.cancellationPolicy ?? buildCancellationPolicy(category)
    ),
    meetingPoint: toStringValue(
      input.meetingPoint || input.meeting_point,
      lookupBase?.meetingPoint ?? `${country.name} central pickup point or direct venue entry`
    ),
    mapQuery: toStringValue(input.mapQuery || input.map_query, lookupBase?.mapQuery ?? `${title}, ${location}`),
    detailsHref: `/things-to-do/${slug}`,
    ticketsHref: toStringValue(input.ticketsHref || input.tickets_href, lookupBase?.ticketsHref ?? buildTicketsHref(title, country.name)),
  };
}

function deriveCountries(attractions: TicketedAttraction[]): AttractionCountry[] {
  const map = new Map<
    string,
    { key: string; name: string; tagline: string; cities: Set<string> }
  >();

  for (const item of attractions) {
    const key = item.countryKey || slugify(item.countryName) || "custom-country";
    const existing = map.get(key);
    if (existing) {
      for (const city of item.cities) existing.cities.add(city);
      if (!existing.tagline && item.tagline) existing.tagline = item.tagline;
    } else {
      map.set(key, {
        key,
        name: item.countryName,
        tagline: item.tagline || `${item.countryName} top experiences`,
        cities: new Set(item.cities),
      });
    }
  }

  return Array.from(map.values())
    .map((entry) => ({
      key: entry.key,
      name: entry.name,
      tagline: entry.tagline,
      cities: Array.from(entry.cities).slice(0, 8),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeCatalog(input: AttractionsInput): AttractionsData {
  const source = Array.isArray(input.attractions) ? input.attractions : [];
  const usedSlugs = new Set<string>();
  const normalized = source
    .map((item, index) => normalizeAttractionRecord(item, index, usedSlugs))
    .filter((item): item is TicketedAttraction => Boolean(item));

  const attractions = normalized.length > 0 ? normalized : seedAttractions;
  return {
    attractions,
    updatedAt: nowIso(),
  };
}

async function ensureAttractionsFile(): Promise<void> {
  await fs.mkdir(runtimeDir, { recursive: true });
  try {
    await fs.access(attractionsFile);
  } catch {
    const seeded: AttractionsData = {
      attractions: seedAttractions,
      updatedAt: nowIso(),
    };
    await fs.writeFile(attractionsFile, JSON.stringify(seeded, null, 2), "utf8");
  }
}

export async function getAttractionsCatalog(): Promise<{
  attractions: TicketedAttraction[];
  countries: AttractionCountry[];
  updatedAt: string;
}> {
  await ensureAttractionsFile();
  const raw = await fs.readFile(attractionsFile, "utf8");
  const parsed = JSON.parse(raw) as AttractionsInput & { updatedAt?: string };
  const normalized = normalizeCatalog(parsed);

  return {
    attractions: normalized.attractions,
    countries: deriveCountries(normalized.attractions),
    updatedAt: parsed.updatedAt ?? normalized.updatedAt,
  };
}

export async function saveAttractionsCatalog(
  input: AttractionsInput
): Promise<{
  attractions: TicketedAttraction[];
  countries: AttractionCountry[];
  updatedAt: string;
}> {
  await ensureAttractionsFile();
  const normalized = normalizeCatalog(input);
  await fs.writeFile(attractionsFile, JSON.stringify(normalized, null, 2), "utf8");

  return {
    attractions: normalized.attractions,
    countries: deriveCountries(normalized.attractions),
    updatedAt: normalized.updatedAt,
  };
}
