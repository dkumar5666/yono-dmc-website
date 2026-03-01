import "server-only";

import crypto from "node:crypto";

export interface LeadFingerprintInput {
  email?: string | null;
  phone?: string | null;
  destination?: string | null;
  travelStart?: string | null;
  travelEnd?: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(value: unknown): string {
  return safeString(value).toLowerCase();
}

export function sanitizePhone(value: unknown): string {
  const raw = safeString(value);
  if (!raw) return "";

  let cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = `+${cleaned.slice(1).replace(/\+/g, "")}`;
  } else {
    cleaned = cleaned.replace(/\+/g, "");
  }

  return cleaned;
}

export function normalizeDestination(value: unknown): string {
  return safeString(value).toLowerCase().replace(/\s+/g, " ");
}

export function normalizeDate(value: unknown): string {
  const raw = safeString(value);
  if (!raw) return "na";
  const isoDate = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "na";
  return isoDate;
}

export function parseDestinationParts(value: unknown): { city: string | null; country: string | null } {
  const normalized = safeString(value);
  if (!normalized) return { city: null, country: null };

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      city: parts[0] || null,
      country: parts.slice(1).join(", ") || null,
    };
  }

  return {
    city: normalized,
    country: null,
  };
}

export function buildLeadFingerprint(input: LeadFingerprintInput): string {
  const contact = sanitizePhone(input.phone) || normalizeEmail(input.email) || "no-contact";
  const destination = normalizeDestination(input.destination) || "na";
  const travelStart = normalizeDate(input.travelStart);
  const travelEnd = normalizeDate(input.travelEnd);
  const canonical = `${contact}|${destination}|${travelStart}|${travelEnd}`;

  return crypto.createHash("sha256").update(canonical).digest("hex");
}