import { SupabaseRestClient } from "@/lib/core/supabase-rest";
import {
  resolveSupplierBooking,
  resolveSupplierIdentityByUserId,
} from "@/lib/supplier/assignmentResolver";
import { handleEvent } from "@/lib/events/handlers";

type GenericRow = Record<string, unknown>;

export interface SupplierBookingActionContext {
  db: SupabaseRestClient;
  supplierId: string;
  supplierName: string | null;
  bookingId: string;
  bookingRef: string;
  bookingRefs: string[];
  bookingRow: GenericRow;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function safeUpdateMany(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.updateSingle(table, query, payload);
    return true;
  } catch {
    return false;
  }
}

async function safeInsert(
  db: SupabaseRestClient,
  table: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.insertSingle(table, payload);
    return true;
  } catch {
    return false;
  }
}

export async function resolveSupplierBookingActionContext(input: {
  userId: string;
  bookingRef: string;
}): Promise<SupplierBookingActionContext | null> {
  const userId = safeString(input.userId);
  const bookingRef = safeString(input.bookingRef);
  if (!userId || !bookingRef) return null;

  const db = new SupabaseRestClient();
  const supplier = await resolveSupplierIdentityByUserId(db, userId);
  if (!supplier?.supplierId) return null;

  const resolved = await resolveSupplierBooking(db, supplier.supplierId, bookingRef);
  if (!resolved.assigned || !resolved.booking) return null;

  const bookingId = safeString(resolved.booking.id);
  const bookingCode = safeString(resolved.booking.booking_code);
  const normalizedBookingRef = bookingCode || bookingId || bookingRef;
  if (!normalizedBookingRef) return null;

  const bookingRefs = Array.from(new Set([bookingId, bookingCode, bookingRef].filter(Boolean)));

  return {
    db,
    supplierId: supplier.supplierId,
    supplierName: supplier.supplierName,
    bookingId: bookingId || normalizedBookingRef,
    bookingRef: normalizedBookingRef,
    bookingRefs,
    bookingRow: resolved.booking,
  };
}

export async function updateSupplierServiceStatus(
  context: SupplierBookingActionContext,
  status: string
): Promise<void> {
  for (const ref of context.bookingRefs) {
    if (!ref) continue;
    await safeUpdateMany(
      context.db,
      "booking_items",
      new URLSearchParams({
        booking_id: `eq.${ref}`,
        supplier_id: `eq.${context.supplierId}`,
      }),
      { status }
    );

    await safeUpdateMany(
      context.db,
      "ground_services",
      new URLSearchParams({
        booking_id: `eq.${ref}`,
        supplier_id: `eq.${context.supplierId}`,
      }),
      { status }
    );
  }
}

export async function updateBookingSupplierStatus(
  context: SupplierBookingActionContext,
  status: string
): Promise<void> {
  if (!context.bookingId) return;
  await safeUpdateMany(
    context.db,
    "bookings",
    new URLSearchParams({
      id: `eq.${context.bookingId}`,
    }),
    { supplier_status: status }
  );
}

export async function writeSupplierLog(input: {
  context: SupplierBookingActionContext;
  action: string;
  status: "success" | "failed";
  message: string;
  payload?: unknown;
}): Promise<void> {
  const { context } = input;
  const basePayload: Record<string, unknown> = {
    booking_id: context.bookingId || context.bookingRef,
    supplier_id: context.supplierId,
    supplier: context.supplierName || context.supplierId,
    action: input.action,
    status: input.status,
    message: input.message,
  };

  const variants: Array<Record<string, unknown>> = [
    {
      ...basePayload,
      payload: input.payload ?? null,
    },
    basePayload,
    {
      booking_id: basePayload.booking_id,
      action: basePayload.action,
      status: basePayload.status,
      message: basePayload.message,
    },
  ];

  for (const variant of variants) {
    if (await safeInsert(context.db, "supplier_logs", variant)) return;
  }
}

export async function writeSupplierSystemLog(input: {
  context: SupplierBookingActionContext;
  event: string;
  message: string;
  level?: "info" | "warn" | "error";
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { context } = input;
  const payload: Record<string, unknown> = {
    level: input.level || "info",
    event: input.event,
    message: input.message,
    booking_id: context.bookingId || context.bookingRef,
    entity_type: "booking",
    entity_id: context.bookingId || context.bookingRef,
    meta: {
      supplier_id: context.supplierId,
      supplier_name: context.supplierName,
      ...input.meta,
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
    if (await safeInsert(context.db, "system_logs", variant)) return;
  }
}

export async function triggerSupplierConfirmedEvent(
  context: SupplierBookingActionContext
): Promise<void> {
  if (!context.bookingId) return;
  try {
    await handleEvent({
      event: "supplier.confirmed",
      bookingId: context.bookingId,
      actorType: "system",
      actorId: context.supplierId,
      payload: {
        source: "supplier_portal",
      },
      idempotencyKey: `supplier_portal:confirmed:${context.bookingId}:${context.supplierId}`,
    });
  } catch {
    // best-effort only
  }
}

