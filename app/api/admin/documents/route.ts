import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

interface RawDocumentRow {
  id?: string | null;
  booking_id?: string | null;
  type?: string | null;
  document_type?: string | null;
  name?: string | null;
  file_name?: string | null;
  url?: string | null;
  public_url?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface AdminDocumentRow {
  id?: string | null;
  booking_id?: string | null;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  created_at?: string | null;
  status?: string | null;
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

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    return await db.selectMany<T>(table, query);
  } catch {
    return [];
  }
}

function deriveName(row: RawDocumentRow): string | null {
  const direct = safeString(row.name) || safeString(row.file_name);
  if (direct) return direct;
  const path = safeString(row.storage_path) || safeString(row.file_path);
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

function deriveUrl(row: RawDocumentRow): string | null {
  return safeString(row.url) || safeString(row.public_url) || safeString(row.file_url) || null;
}

function deriveFileRef(row: RawDocumentRow): string | null {
  return safeString(row.storage_path) || safeString(row.file_path) || null;
}

function isMissingDocument(row: AdminDocumentRow & { _fileRef?: string | null }): boolean {
  const status = safeString(row.status).toLowerCase();
  const missingUrl = !safeString(row.url);
  const missingRef = !safeString(row._fileRef);
  return missingUrl || missingRef || status === "pending" || status === "failed";
}

async function fetchDocuments(db: SupabaseRestClient): Promise<Array<AdminDocumentRow & { _fileRef?: string | null }>> {
  const attempts: Array<{ table: string; select: string }> = [
    {
      table: "documents",
      select: "id,booking_id,type,status,public_url,storage_path,created_at",
    },
    {
      table: "documents",
      select: "id,booking_id,type,public_url,storage_path,created_at",
    },
    {
      table: "booking_documents",
      select: "id,booking_id,type,name,url,status,created_at,file_path",
    },
    {
      table: "booking_documents",
      select: "id,booking_id,document_type,file_name,file_url,status,created_at,file_path",
    },
    {
      table: "booking_documents",
      select: "id,booking_id,document_type,file_name,file_url,created_at",
    },
  ];

  for (const attempt of attempts) {
    const rows = await safeSelectMany<RawDocumentRow>(
      db,
      attempt.table,
      new URLSearchParams({
        select: attempt.select,
        order: "created_at.desc",
        limit: "500",
      })
    );
    if (rows.length > 0) {
      return rows.map((row) => ({
        id: row.id ?? null,
        booking_id: row.booking_id ?? null,
        type: safeString(row.type) || safeString(row.document_type) || null,
        name: deriveName(row),
        url: deriveUrl(row),
        created_at: row.created_at ?? null,
        status: safeString(row.status) || null,
        _fileRef: deriveFileRef(row),
      }));
    }
  }

  return [];
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);
    const typeFilter = safeString(url.searchParams.get("type")).toLowerCase();
    const bookingFilter = safeString(url.searchParams.get("booking_id")).toLowerCase();
    const q = safeString(url.searchParams.get("q")).toLowerCase();
    const missingOnly = url.searchParams.get("missing_only") === "1";
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const rows = await fetchDocuments(db);

    const filtered = rows.filter((row) => {
      const type = safeString(row.type).toLowerCase();
      const bookingId = safeString(row.booking_id).toLowerCase();
      const name = safeString(row.name).toLowerCase();
      const status = safeString(row.status).toLowerCase();

      if (typeFilter && typeFilter !== "all" && type !== typeFilter) return false;
      if (bookingFilter && !bookingId.includes(bookingFilter)) return false;

      if (q) {
        const haystack = [name, type, bookingId, status].join(" ");
        if (!haystack.includes(q)) return false;
      }

      if (missingOnly && !isMissingDocument(row)) return false;

      return true;
    });

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit).map((row) => ({
      id: row.id ?? null,
      booking_id: row.booking_id ?? null,
      type: row.type ?? null,
      name: row.name ?? null,
      url: row.url ?? null,
      created_at: row.created_at ?? null,
      status: row.status ?? null,
    }));

    return NextResponse.json({ rows: paged, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }
    return routeError(500, "Failed to load admin documents");
  }
}
