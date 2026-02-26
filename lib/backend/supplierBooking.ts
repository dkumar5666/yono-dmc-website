import { logWarn } from "@/lib/backend/logger";
import { acquireSupplierLock, buildSupplierIdempotencyKey, markSupplierLock } from "@/lib/system/supplierLock";

type SupplierBookAction = "book";

export interface GuardedSupplierBookingInput<T> {
  bookingId: string;
  supplier: string;
  action?: SupplierBookAction;
  itemId?: string | null;
  providerRef?: string | null;
  requestId?: string | null;
  routeKey?: string | null;
  productKey?: string | null;
  meta?: Record<string, unknown>;
  execute: () => Promise<T>;
}

export interface GuardedSupplierBookingResult<T> {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  result?: T;
  idempotencyKey: string;
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveRef(input: GuardedSupplierBookingInput<unknown>): string {
  return (
    safeText(input.itemId) ||
    safeText(input.providerRef) ||
    safeText(input.requestId) ||
    safeText(input.routeKey) ||
    safeText(input.productKey) ||
    "na"
  );
}

function extractConfirmationRef(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const row = result as Record<string, unknown>;
  const candidates = [
    row.confirmationRef,
    row.confirmation_ref,
    row.bookingReference,
    row.booking_reference,
    row.provider_booking_id,
    row.providerBookingId,
    row.pnr,
    row.orderId,
    row.order_id,
  ];
  for (const candidate of candidates) {
    const normalized = safeText(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export async function executeGuardedSupplierBooking<T>(
  input: GuardedSupplierBookingInput<T>
): Promise<GuardedSupplierBookingResult<T>> {
  const bookingId = safeText(input.bookingId);
  const supplier = safeText(input.supplier).toLowerCase();
  const action: SupplierBookAction = input.action ?? "book";
  const ref = resolveRef(input);

  const idempotencyKey = buildSupplierIdempotencyKey({
    bookingId,
    supplier,
    action,
    ref,
  });

  const lockResult = await acquireSupplierLock({
    bookingId,
    supplier,
    action,
    idempotencyKey,
    meta: {
      ref,
      ...(input.meta ?? {}),
    },
  });

  if (lockResult.ok && lockResult.skipped) {
    return {
      ok: true,
      skipped: true,
      reason: "duplicate_supplier_booking",
      idempotencyKey,
    };
  }

  if (!lockResult.ok) {
    logWarn("Supplier idempotency lock unavailable, continuing supplier booking fallback", {
      bookingId,
      supplier,
      action,
      idempotencyKey,
      reason: lockResult.reason ?? "lock_unavailable",
    });
  }

  try {
    const result = await input.execute();
    const confirmationRef = extractConfirmationRef(result);
    await markSupplierLock(idempotencyKey, {
      status: "processed",
      meta: {
        ref,
        ...(confirmationRef ? { confirmationRef } : {}),
      },
    });

    return {
      ok: true,
      skipped: false,
      idempotencyKey,
      result,
    };
  } catch (error) {
    await markSupplierLock(idempotencyKey, {
      status: "failed",
      meta: {
        ref,
        error: error instanceof Error ? error.message : "Unknown supplier booking error",
      },
    });
    throw error;
  }
}

