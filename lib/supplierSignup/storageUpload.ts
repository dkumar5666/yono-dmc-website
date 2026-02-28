import "server-only";

import { SupabaseRestClient, getSupabaseConfig } from "@/lib/core/supabase-rest";
import type { SupplierDocType } from "@/lib/supplierSignup/validators";

export const SUPPLIER_KYC_BUCKET = "supplier-kyc";
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const ALLOWED_EXT = new Set(["pdf", "jpg", "jpeg", "png"]);

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(name: string): string {
  const trimmed = safeString(name).toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9._-]+/g, "_");
  return safe || "document";
}

function fileExt(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

export function validateSupplierSignupUpload(file: File): { ok: true } | { ok: false; message: string } {
  if (!(file instanceof File)) {
    return { ok: false, message: "File is required." };
  }
  if (file.size <= 0) {
    return { ok: false, message: "Empty file is not allowed." };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, message: "File size must be 10MB or less." };
  }

  const ext = fileExt(file.name);
  const mime = safeString(file.type).toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(mime)) {
    return { ok: false, message: "Only PDF, JPG, JPEG, PNG files are allowed." };
  }

  return { ok: true };
}

export interface SupplierSignupUploadResult {
  bucket: string;
  path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  public_url: string;
}

export async function uploadSupplierSignupDocument(params: {
  db: SupabaseRestClient;
  requestId: string;
  docType: SupplierDocType;
  file: File;
}): Promise<SupplierSignupUploadResult> {
  const safeName = sanitizeFileName(params.file.name || `${params.docType}.pdf`);
  const ext = fileExt(safeName) || "pdf";
  const objectPath = `requests/${params.requestId}/${params.docType}_${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await params.file.arrayBuffer());
  const mimeType = safeString(params.file.type) || "application/octet-stream";

  await params.db.uploadFile(SUPPLIER_KYC_BUCKET, objectPath, bytes, mimeType);
  const publicUrl = params.db.publicUrl(SUPPLIER_KYC_BUCKET, objectPath);

  return {
    bucket: SUPPLIER_KYC_BUCKET,
    path: objectPath,
    file_name: safeName,
    file_size: params.file.size,
    mime_type: mimeType,
    public_url: publicUrl,
  };
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export async function createSupplierSignupDocSignedUrl(
  storagePath: string,
  expiresIn = 60 * 60
): Promise<string | null> {
  const config = getSupabaseConfig();
  const cleanPath = safeString(storagePath).replace(/^\/+/, "");
  if (!config || !cleanPath) return null;

  const encodedPath = encodeStoragePath(cleanPath);
  const endpoint = `${config.url}/storage/v1/object/sign/${SUPPLIER_KYC_BUCKET}/${encodedPath}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json().catch(() => ({}))) as {
      signedURL?: string;
      signedUrl?: string;
    };
    const signedPath = payload.signedURL || payload.signedUrl;
    if (!signedPath) return null;
    return `${config.url}/storage/v1${signedPath}`;
  } catch {
    return null;
  }
}
