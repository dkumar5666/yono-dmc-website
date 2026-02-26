"use strict";

/**
 * Dev-only demonstration of guarded supplier booking behavior.
 * No external deps. Pure in-memory lock simulation.
 *
 * Run:
 *   node scripts/supplier-booking-idempotency-demo.js
 */

const locks = new Set();

function buildSupplierIdempotencyKey({ bookingId, supplier, action, ref }) {
  return `sup:${String(supplier || "").toLowerCase()}|act:${String(action || "").toLowerCase()}|bk:${bookingId}|ref:${
    ref || "na"
  }`;
}

async function acquireSupplierLock({ idempotencyKey }) {
  if (locks.has(idempotencyKey)) {
    return { ok: true, skipped: true, reason: "duplicate" };
  }
  locks.add(idempotencyKey);
  return { ok: true, skipped: false };
}

async function executeGuardedSupplierBooking({ bookingId, supplier, ref, execute }) {
  const idempotencyKey = buildSupplierIdempotencyKey({
    bookingId,
    supplier,
    action: "book",
    ref: ref || "na",
  });

  const lock = await acquireSupplierLock({ idempotencyKey });
  if (lock.ok && lock.skipped) {
    return { ok: true, skipped: true, reason: "duplicate_supplier_booking", idempotencyKey };
  }

  const result = await execute();
  return { ok: true, skipped: false, idempotencyKey, result };
}

async function main() {
  let supplierBookCalls = 0;
  const execute = async () => {
    supplierBookCalls += 1;
    return { confirmationRef: "PNR-DEMO-001" };
  };

  const first = await executeGuardedSupplierBooking({
    bookingId: "BK-DEMO-001",
    supplier: "amadeus",
    ref: "item-1",
    execute,
  });

  const second = await executeGuardedSupplierBooking({
    bookingId: "BK-DEMO-001",
    supplier: "amadeus",
    ref: "item-1",
    execute,
  });

  console.log("first:", first);
  console.log("second:", second);
  console.log("supplierBookCalls:", supplierBookCalls);
  console.log(
    supplierBookCalls === 1 && first.skipped === false && second.skipped === true
      ? "PASS: duplicate booking skipped, external call executed once"
      : "FAIL: idempotency behavior unexpected"
  );
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exitCode = 1;
});

