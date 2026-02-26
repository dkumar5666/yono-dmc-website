import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

interface SupplierLockKeyArgs {
  bookingId: string;
  supplier: string;
  action: string;
  ref?: string | null;
}

interface SupplierLockAcquireParams {
  bookingId: string;
  supplier: string;
  action: string;
  idempotencyKey?: string | null;
  meta?: unknown;
}

interface SupplierLockPatch {
  status?: string;
  meta?: unknown;
}

interface SupplierLockRow {
  id?: string | null;
}

interface SupplierLockResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  lockId?: string;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function lowerToken(value: string | null | undefined): string {
  return normalizeToken(value).toLowerCase();
}

function looksLikeUniqueViolation(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("23505") ||
    lower.includes("duplicate key") ||
    (lower.includes("unique") && lower.includes("supplier_action_locks")) ||
    lower.includes("409")
  );
}

function looksLikeMissingTable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("42p01") ||
    (lower.includes("relation") && lower.includes("does not exist")) ||
    (lower.includes("table") && lower.includes("supplier_action_locks"))
  );
}

function logLockFailure(reason: string, context: Record<string, unknown>) {
  console.warn("supplier_action_lock unavailable; continuing without idempotency lock", {
    reason,
    ...context,
  });
}

export function buildSupplierIdempotencyKey(args: SupplierLockKeyArgs): string {
  const bookingId = normalizeToken(args.bookingId);
  const supplier = lowerToken(args.supplier);
  const action = lowerToken(args.action);
  const ref = normalizeToken(args.ref) || "na";

  return `sup:${supplier}|act:${action}|bk:${bookingId}|ref:${ref}`;
}

export async function acquireSupplierLock(
  params: SupplierLockAcquireParams
): Promise<SupplierLockResult> {
  const bookingId = normalizeToken(params.bookingId);
  const supplier = lowerToken(params.supplier);
  const action = lowerToken(params.action);
  const idempotencyKey =
    normalizeToken(params.idempotencyKey) ||
    buildSupplierIdempotencyKey({ bookingId, supplier, action, ref: null });

  if (!bookingId || !supplier || !action) {
    return { ok: false, skipped: false, reason: "lock_unavailable" };
  }

  try {
    const db = new SupabaseRestClient();
    const inserted = await db.insertSingle<SupplierLockRow>("supplier_action_locks", {
      booking_id: bookingId,
      supplier,
      action,
      idempotency_key: idempotencyKey,
      status: "locked",
      meta: params.meta ?? null,
    });

    return {
      ok: true,
      skipped: false,
      lockId: normalizeToken(inserted?.id) || undefined,
    };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      await logLockFailure("supabase_not_configured", {
        booking_id: bookingId,
        supplier,
        action,
      });
      return { ok: false, skipped: false, reason: "supabase_not_configured" };
    }

    const message = error instanceof Error ? error.message : "Unknown supplier lock error";
    if (looksLikeUniqueViolation(message)) {
      return { ok: true, skipped: true, reason: "duplicate" };
    }

    if (looksLikeMissingTable(message)) {
      logLockFailure("supplier_action_locks_table_missing", {
        booking_id: bookingId,
        supplier,
        action,
      });
      return { ok: false, skipped: false, reason: "lock_unavailable" };
    }

    logLockFailure("supplier_lock_insert_failed", {
      booking_id: bookingId,
      supplier,
      action,
    });
    return { ok: false, skipped: false, reason: "lock_unavailable" };
  }
}

export async function markSupplierLock(
  idempotencyKey: string,
  patch: SupplierLockPatch
): Promise<void> {
  const key = normalizeToken(idempotencyKey);
  if (!key) return;

  try {
    const db = new SupabaseRestClient();
    const query = new URLSearchParams({
      idempotency_key: `eq.${key}`,
    });
    const existing = await db.selectSingle<{ meta?: unknown }>(
      "supplier_action_locks",
      new URLSearchParams({
        ...Object.fromEntries(query.entries()),
        select: "meta",
      })
    );

    let mergedMeta: unknown = patch.meta;
    if (patch.meta !== undefined && existing?.meta && typeof existing.meta === "object" && typeof patch.meta === "object") {
      mergedMeta = {
        ...(existing.meta as Record<string, unknown>),
        ...(patch.meta as Record<string, unknown>),
      };
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof patch.status === "string" && patch.status.trim()) {
      payload.status = patch.status.trim();
    }
    if (patch.meta !== undefined) {
      payload.meta = mergedMeta;
    }

    await db.updateSingle(
      "supplier_action_locks",
      query,
      payload
    );
  } catch {
    // best-effort only
  }
}
