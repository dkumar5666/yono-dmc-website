export const SUPPLIER_BUSINESS_TYPES = [
  "Airline",
  "Hotel",
  "Apartment / Villa / Homestay",
  "Visa Agency / Aggregator",
  "Cruise Line",
  "Transport Company (Bus/Cabs)",
  "Train Service Provider / Agent",
  "Forex Agency",
  "Insurance Company",
  "Activities / Attractions Provider",
  "Other",
] as const;

export const REQUIRED_DOC_TYPES = [
  "gst_certificate",
  "pan_card",
  "business_registration",
] as const;

export const OPTIONAL_DOC_TYPES = [
  "bank_proof",
  "owner_id_proof",
] as const;

export const ALL_DOC_TYPES = [...REQUIRED_DOC_TYPES, ...OPTIONAL_DOC_TYPES] as const;

export type SupplierDocType = (typeof ALL_DOC_TYPES)[number];

export interface SupplierSignupRequestInput {
  business_type: string;
  company_legal_name: string;
  brand_name?: string;
  address: string;
  city: string;
  country: string;
  website?: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  alt_phone?: string;
  support_email?: string;
  gstin: string;
  pan: string;
  cin?: string;
  iata_code?: string;
  license_no?: string;
  bank_meta?: Record<string, unknown>;
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
  data: SupplierSignupRequestInput | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function normalizeEmail(value: unknown): string {
  return safeString(value).toLowerCase();
}

export function normalizeWebsite(value: unknown): string {
  const raw = safeString(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function normalizePhone(value: unknown): string {
  const raw = safeString(value);
  if (!raw) return "";
  if (raw.startsWith("+")) {
    return `+${raw.slice(1).replace(/\D/g, "")}`;
  }
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidE164Phone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function isValidWebsite(value: string): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidGstin(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(value);
}

export function isValidPan(value: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(value);
}

function normalizeBusinessType(value: unknown): string {
  const raw = safeString(value);
  if (!raw) return "";
  const found = SUPPLIER_BUSINESS_TYPES.find(
    (entry) => entry.toLowerCase() === raw.toLowerCase()
  );
  return found || raw;
}

function normalizeCountry(value: unknown): string {
  const raw = safeString(value);
  return raw || "India";
}

export function validateSupplierSignupRequestPayload(payload: unknown): ValidationResult {
  const body = safeObject(payload);
  const errors: string[] = [];

  const business_type = normalizeBusinessType(body.business_type);
  const company_legal_name = safeString(body.company_legal_name);
  const brand_name = safeString(body.brand_name);
  const address = safeString(body.address);
  const city = safeString(body.city);
  const country = normalizeCountry(body.country);
  const website = normalizeWebsite(body.website);
  const contact_name = safeString(body.contact_name);
  const contact_email = normalizeEmail(body.contact_email);
  const contact_phone = normalizePhone(body.contact_phone);
  const alt_phone = normalizePhone(body.alt_phone);
  const support_email = normalizeEmail(body.support_email);
  const gstin = safeString(body.gstin).toUpperCase();
  const pan = safeString(body.pan).toUpperCase();
  const cin = safeString(body.cin);
  const iata_code = safeString(body.iata_code);
  const license_no = safeString(body.license_no);
  const bank_meta = safeObject(body.bank_meta);

  if (!business_type) errors.push("Business type is required.");
  if (!company_legal_name) errors.push("Company legal name is required.");
  if (!address) errors.push("Registered address is required.");
  if (!city) errors.push("City is required.");
  if (!contact_name) errors.push("Primary contact name is required.");
  if (!contact_email) errors.push("Primary contact email is required.");
  if (!contact_phone) errors.push("Primary contact mobile is required.");

  if (contact_email && !isValidEmail(contact_email)) {
    errors.push("Primary contact email is invalid.");
  }
  if (support_email && !isValidEmail(support_email)) {
    errors.push("Support email is invalid.");
  }
  if (contact_phone && !isValidE164Phone(contact_phone)) {
    errors.push("Primary contact mobile must be in E.164 format.");
  }
  if (alt_phone && !isValidE164Phone(alt_phone)) {
    errors.push("Alternate phone must be in E.164 format.");
  }
  if (website && !isValidWebsite(website)) {
    errors.push("Website URL is invalid.");
  }

  if (country.toLowerCase() === "india" && !gstin) {
    errors.push("GSTIN is required for India businesses.");
  }
  if (gstin && !isValidGstin(gstin)) {
    errors.push("GSTIN format is invalid.");
  }
  if (!pan) {
    errors.push("PAN is required.");
  } else if (!isValidPan(pan)) {
    errors.push("PAN format is invalid.");
  }

  if (errors.length > 0) {
    return { ok: false, errors, data: null };
  }

  return {
    ok: true,
    errors: [],
    data: {
      business_type,
      company_legal_name,
      brand_name: brand_name || undefined,
      address,
      city,
      country,
      website: website || undefined,
      contact_name,
      contact_email,
      contact_phone,
      alt_phone: alt_phone || undefined,
      support_email: support_email || undefined,
      gstin,
      pan,
      cin: cin || undefined,
      iata_code: iata_code || undefined,
      license_no: license_no || undefined,
      bank_meta,
    },
  };
}

export function hasRequiredSupplierDocs(docs: unknown): boolean {
  if (!docs || typeof docs !== "object" || Array.isArray(docs)) return false;
  const obj = docs as Record<string, unknown>;
  return REQUIRED_DOC_TYPES.every((docType) => {
    const value = obj[docType];
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    return typeof row.path === "string" && row.path.trim().length > 0;
  });
}

export function isValidDocType(value: unknown): value is SupplierDocType {
  const raw = safeString(value);
  return ALL_DOC_TYPES.includes(raw as SupplierDocType);
}
