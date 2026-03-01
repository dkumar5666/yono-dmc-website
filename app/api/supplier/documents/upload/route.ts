import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import {
  resolveSupplierBooking,
  resolveSupplierIdentityByUserId,
} from "@/lib/supplier/assignmentResolver";

const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET?.trim() || "documents";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9._-]+/g, "_");
  return safe || "invoice.pdf";
}

async function safeInsert(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    return await db.insertSingle<Record<string, unknown>>(table, payload);
  } catch {
    return null;
  }
}

async function writeSupplierLog(input: {
  db: SupabaseRestClient;
  bookingId: string;
  supplierId: string;
  supplierName?: string | null;
  message: string;
  payload?: unknown;
}) {
  const base: Record<string, unknown> = {
    booking_id: input.bookingId,
    supplier_id: input.supplierId,
    supplier: input.supplierName || input.supplierId,
    action: "invoice_upload",
    status: "success",
    message: input.message,
  };

  const variants: Array<Record<string, unknown>> = [
    { ...base, payload: input.payload ?? null },
    base,
    {
      booking_id: base.booking_id,
      action: base.action,
      status: base.status,
      message: base.message,
    },
  ];

  for (const variant of variants) {
    if (await safeInsert(input.db, "supplier_logs", variant)) return;
  }
}

async function writeSystemLog(input: {
  db: SupabaseRestClient;
  bookingId: string;
  supplierId: string;
  message: string;
  meta?: Record<string, unknown>;
}) {
  const payload: Record<string, unknown> = {
    level: "info",
    event: "supplier.invoice_uploaded",
    message: input.message,
    booking_id: input.bookingId,
    entity_type: "booking",
    entity_id: input.bookingId,
    meta: {
      supplier_id: input.supplierId,
      ...(input.meta ?? {}),
    },
  };

  const variants: Array<Record<string, unknown>> = [
    payload,
    {
      level: payload.level,
      event: payload.event,
      message: payload.message,
      meta: payload.meta,
    },
    {
      event: payload.event,
      message: payload.message,
      meta: payload.meta,
    },
    {
      message: payload.message,
    },
  ];

  for (const variant of variants) {
    if (await safeInsert(input.db, "system_logs", variant)) return;
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, "supplier");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const formData = await req.formData();
    const bookingRef = safeString(formData.get("booking_id"));
    const file = formData.get("file");

    if (!bookingRef) {
      return NextResponse.json({ success: false, error: "booking_id is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ success: false, error: "Empty file is not allowed" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "File size must be <= 15MB" }, { status: 400 });
    }

    const db = new SupabaseRestClient();
    const supplier = await resolveSupplierIdentityByUserId(db, auth.userId);
    if (!supplier?.supplierId) return routeError(403, "Not authorized");

    const resolvedBooking = await resolveSupplierBooking(db, supplier.supplierId, bookingRef);
    if (!resolvedBooking.assigned || !resolvedBooking.booking) {
      return routeError(404, "Booking not found");
    }

    const bookingId = safeString(resolvedBooking.booking.id) || resolvedBooking.booking_id;
    const bookingCode =
      safeString(resolvedBooking.booking.booking_code) || bookingId || bookingRef;
    const timestamp = Date.now();
    const originalName = sanitizeFileName(file.name || "invoice.pdf");
    const extension = originalName.includes(".") ? originalName.split(".").pop() : "pdf";
    const objectPath = `suppliers/${supplier.supplierId}/bookings/${bookingCode}/invoice_${timestamp}.${extension || "pdf"}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    await db.uploadFile(DOCUMENTS_BUCKET, objectPath, bytes, file.type || "application/octet-stream");
    const publicUrl = db.publicUrl(DOCUMENTS_BUCKET, objectPath);

    const insertCandidates: Array<{ table: string; payload: Record<string, unknown> }> = [
      {
        table: "documents",
        payload: {
          booking_id: bookingId,
          supplier_id: supplier.supplierId,
          type: "supplier_invoice",
          name: file.name || originalName,
          status: "ready",
          storage_path: objectPath,
          url: publicUrl,
          public_url: publicUrl,
        },
      },
      {
        table: "documents",
        payload: {
          booking_id: bookingId,
          type: "supplier_invoice",
          name: file.name || originalName,
          status: "ready",
          storage_path: objectPath,
          url: publicUrl,
          public_url: publicUrl,
        },
      },
      {
        table: "booking_documents",
        payload: {
          booking_id: bookingId,
          type: "supplier_invoice",
          file_name: file.name || originalName,
          status: "ready",
          file_path: objectPath,
          file_url: publicUrl,
        },
      },
    ];

    let inserted: Record<string, unknown> | null = null;
    for (const candidate of insertCandidates) {
      inserted = await safeInsert(db, candidate.table, candidate.payload);
      if (inserted) break;
    }

    const message = "Supplier invoice uploaded";
    await writeSupplierLog({
      db,
      bookingId,
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      message,
      payload: {
        document_id: safeString(inserted?.id) || null,
        file_name: file.name || originalName,
        file_size: file.size,
      },
    });
    await writeSystemLog({
      db,
      bookingId,
      supplierId: supplier.supplierId,
      message,
      meta: {
        document_id: safeString(inserted?.id) || null,
      },
    });

    return NextResponse.json({
      ok: true,
      booking_id: bookingCode,
      document_id: safeString(inserted?.id) || null,
      url: publicUrl,
      status: "ready",
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(500, "Supabase is not configured");
    }
    return routeError(500, "Failed to upload invoice");
  }
}

