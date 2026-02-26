import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type Params = { id: string };
type GenericRow = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function safeSelectSingle<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T | null> {
  try {
    return await db.selectSingle<T>(table, query);
  } catch {
    return null;
  }
}

function normalizeLog(row: GenericRow | null) {
  if (!row) return null;
  return {
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_id) || null,
    supplier:
      safeString(row.supplier) ||
      safeString(row.supplier_name) ||
      safeString(row.provider) ||
      safeString(row.supplier_code) ||
      safeString(row.supplier_id) ||
      null,
    action:
      safeString(row.action) ||
      safeString(row.operation) ||
      safeString(row.event_name) ||
      safeString(row.event) ||
      null,
    status: safeString(row.status) || safeString(row.result) || safeString(row.level) || null,
    message:
      safeString(row.message) ||
      safeString(row.error_message) ||
      safeString(row.note) ||
      safeString(row.reason) ||
      null,
    created_at: safeString(row.created_at) || null,
    request_payload:
      row.request_payload ??
      row.request ??
      row.request_body ??
      null,
    response_payload:
      row.response_payload ??
      row.response ??
      row.response_body ??
      null,
    payload:
      row.payload ??
      row.raw_payload ??
      row.provider_payload ??
      null,
    meta:
      row.meta ??
      row.metadata ??
      null,
  };
}

async function resolveLog(db: SupabaseRestClient, id: string): Promise<GenericRow | null> {
  const candidates: Array<{ table: string; selects: string[] }> = [
    {
      table: "supplier_logs",
      selects: [
        "id,booking_id,supplier,action,status,message,created_at,payload,request,response,request_payload,response_payload,meta",
        "id,booking_id,supplier,action,status,message,created_at,payload,meta",
        "*",
      ],
    },
    {
      table: "supplier_api_logs",
      selects: [
        "id,booking_id,provider,operation,status,message,created_at,payload,request,response,request_payload,response_payload,meta",
        "id,booking_id,provider,operation,result,error_message,created_at,payload,request_payload,response_payload,metadata",
        "*",
      ],
    },
  ];

  for (const candidate of candidates) {
    for (const select of candidate.selects) {
      const row = await safeSelectSingle<GenericRow>(
        db,
        candidate.table,
        new URLSearchParams({
          select,
          id: `eq.${id}`,
        })
      );
      if (row) return row;
    }
  }

  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in params ? await params : params;
    const id = decodeURIComponent(resolved.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ log: null });
    }

    const db = new SupabaseRestClient();
    const row = await resolveLog(db, id);
    return NextResponse.json({ log: normalizeLog(row) });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ log: null });
    }
    return routeError(500, "Failed to load supplier log details");
  }
}

