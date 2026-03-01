import "server-only";

import { generateDocsForBooking } from "@/lib/documents/generateBookingDocs";
import { transitionBookingLifecycle } from "@/lib/core/booking-lifecycle.engine";
import { SupabaseRestClient } from "@/lib/core/supabase-rest";

export type AutomationEventName =
  | "payment.confirmed"
  | "supplier.confirmed"
  | "documents.generated"
  | "documents.generate";

interface HandleEventInput {
  event: string;
  bookingId?: string | null;
  payload?: unknown;
  actorType?: "system" | "webhook" | "admin";
  actorId?: string | null;
  idempotencyKey?: string | null;
}

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  customer_id?: string | null;
  lifecycle_status?: string | null;
  payment_status?: string | null;
  supplier_status?: string | null;
  supplier_confirmation_reference?: string | null;
  currency_code?: string | null;
  gross_amount?: number | string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEventName(value: string): AutomationEventName | null {
  const normalized = value.trim().toLowerCase().replace(/_/g, ".");
  if (
    normalized === "payment.confirmed" ||
    normalized === "booking.payment.confirmed" ||
    normalized === "booking.paymentconfirmed"
  ) {
    return "payment.confirmed";
  }
  if (
    normalized === "supplier.confirmed" ||
    normalized === "booking.supplier.confirmed" ||
    normalized === "booking.supplierconfirmed"
  ) {
    return "supplier.confirmed";
  }
  if (
    normalized === "documents.generate" ||
    normalized === "booking.documents.generate" ||
    normalized === "booking.documentsgenerate"
  ) {
    return "documents.generate";
  }
  if (
    normalized === "documents.generated" ||
    normalized === "booking.documents.generated" ||
    normalized === "booking.documentsgenerated"
  ) {
    return "documents.generated";
  }
  return null;
}

function supplierLooksConfirmed(booking: BookingRow): boolean {
  const lifecycle = safeString(booking.lifecycle_status).toLowerCase();
  const supplierStatus = safeString(booking.supplier_status).toLowerCase();
  const supplierRef = safeString(booking.supplier_confirmation_reference);

  if (supplierRef) return true;
  if (supplierStatus.includes("confirm")) return true;
  return ["supplier_confirmed", "documents_generated", "completed"].includes(lifecycle);
}

function isLifecycleAtOrBeyondDocuments(booking: BookingRow): boolean {
  const lifecycle = safeString(booking.lifecycle_status).toLowerCase();
  return lifecycle === "documents_generated" || lifecycle === "completed";
}

function isLifecycleAtOrBeyondSupplierConfirmation(booking: BookingRow): boolean {
  const lifecycle = safeString(booking.lifecycle_status).toLowerCase();
  return (
    lifecycle === "supplier_confirmed" ||
    lifecycle === "documents_generated" ||
    lifecycle === "completed"
  );
}

function getBookingIdFromInput(input: HandleEventInput): string {
  const direct = safeString(input.bookingId);
  if (direct) return direct;

  const payload = asRecord(input.payload);
  const nestedPayload = asRecord(payload.payload);

  return (
    safeString(payload.booking_id) ||
    safeString(payload.bookingId) ||
    safeString(nestedPayload.booking_id) ||
    safeString(nestedPayload.bookingId)
  );
}

async function resolveBooking(db: SupabaseRestClient, bookingIdentifier: string): Promise<BookingRow | null> {
  if (!bookingIdentifier) return null;

  const select =
    "id,booking_code,customer_id,lifecycle_status,payment_status,supplier_status,supplier_confirmation_reference,currency_code,gross_amount";

  const byCode = await db
    .selectSingle<BookingRow>(
      "bookings",
      new URLSearchParams({
        select,
        booking_code: `eq.${bookingIdentifier}`,
      })
    )
    .catch(() => null);
  if (byCode) return byCode;

  if (looksLikeUuid(bookingIdentifier)) {
    return db
      .selectSingle<BookingRow>(
        "bookings",
        new URLSearchParams({
          select,
          id: `eq.${bookingIdentifier}`,
        })
      )
      .catch(() => null);
  }

  return null;
}

async function updateBookingStatusFlags(
  db: SupabaseRestClient,
  bookingId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await db
    .updateSingle(
      "bookings",
      new URLSearchParams({
        id: `eq.${bookingId}`,
      }),
      patch
    )
    .catch(() => null);
}

async function ensurePaymentConfirmed(input: {
  booking: BookingRow;
  actorType: "system" | "webhook" | "admin";
  actorId?: string | null;
  idempotencyRoot: string;
}): Promise<void> {
  await transitionBookingLifecycle({
    bookingId: safeString(input.booking.id),
    toStatus: "payment_confirmed",
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    idempotencyKey: `${input.idempotencyRoot}:payment_confirmed`,
    note: "Automation handler: payment confirmed",
  });
}

async function ensureSupplierConfirmed(input: {
  booking: BookingRow;
  actorType: "system" | "webhook" | "admin";
  actorId?: string | null;
  idempotencyRoot: string;
}): Promise<void> {
  await transitionBookingLifecycle({
    bookingId: safeString(input.booking.id),
    toStatus: "supplier_confirmed",
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    idempotencyKey: `${input.idempotencyRoot}:supplier_confirmed`,
    note: "Automation handler: supplier confirmed",
  });
}

async function ensureDocumentsGenerated(input: {
  booking: BookingRow;
  actorType: "system" | "webhook" | "admin";
  actorId?: string | null;
  idempotencyRoot: string;
}): Promise<void> {
  await transitionBookingLifecycle({
    bookingId: safeString(input.booking.id),
    toStatus: "documents_generated",
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    idempotencyKey: `${input.idempotencyRoot}:documents_generated`,
    note: "Automation handler: documents generated",
  });
}

export async function handleEvent(input: HandleEventInput): Promise<void> {
  const normalizedEvent = normalizeEventName(input.event);
  if (!normalizedEvent) {
    throw new Error(`Unsupported automation event: ${input.event}`);
  }

  const bookingIdentifier = getBookingIdFromInput(input);
  if (!bookingIdentifier) {
    throw new Error("Missing booking_id for automation event");
  }

  const db = new SupabaseRestClient();
  const booking = await resolveBooking(db, bookingIdentifier);
  if (!booking?.id) {
    throw new Error(`Booking not found for automation event: ${bookingIdentifier}`);
  }

  const actorType = input.actorType ?? "system";
  const idempotencyRoot =
    safeString(input.idempotencyKey) ||
    `automation:${normalizedEvent}:${safeString(booking.id)}`;

  if (normalizedEvent === "payment.confirmed") {
    await updateBookingStatusFlags(db, safeString(booking.id), {
      payment_status: "captured",
    });

    if (!isLifecycleAtOrBeyondSupplierConfirmation(booking)) {
      await ensurePaymentConfirmed({
        booking,
        actorType,
        actorId: input.actorId ?? null,
        idempotencyRoot,
      });
    }

    const docsSummary = await generateDocsForBooking(safeString(booking.id), "payment.confirmed");
    if (docsSummary.failed.length > 0) {
      throw new Error(
        `Document generation failed after payment confirmation: ${docsSummary.failed
          .map((entry) => `${entry.type}:${entry.error}`)
          .join(", ")}`
      );
    }

    if (isLifecycleAtOrBeyondDocuments(booking)) {
      return;
    }

    if (supplierLooksConfirmed(booking)) {
      await handleEvent({
        event: "supplier.confirmed",
        bookingId: safeString(booking.id),
        actorType,
        actorId: input.actorId ?? null,
        idempotencyKey: idempotencyRoot,
        payload: input.payload,
      });
    }
    return;
  }

  if (normalizedEvent === "supplier.confirmed") {
    if (isLifecycleAtOrBeyondDocuments(booking)) {
      return;
    }

    await updateBookingStatusFlags(db, safeString(booking.id), {
      supplier_status: "confirmed",
    });

    await ensureSupplierConfirmed({
      booking,
      actorType,
      actorId: input.actorId ?? null,
      idempotencyRoot,
    });

    await handleEvent({
      event: "documents.generate",
      bookingId: safeString(booking.id),
      actorType,
      actorId: input.actorId ?? null,
      idempotencyKey: idempotencyRoot,
      payload: input.payload,
    });
    return;
  }

  const payload = asRecord(input.payload);
  const triggerOverride =
    safeString(payload.trigger) ||
    safeString(payload.retry_trigger) ||
    (normalizedEvent === "documents.generate" ? "cron_retry" : normalizedEvent);

  const docsSummary = await generateDocsForBooking(safeString(booking.id), triggerOverride);
  if (docsSummary.failed.length > 0) {
    throw new Error(
      `Document generation failed: ${docsSummary.failed
        .map((entry) => `${entry.type}:${entry.error}`)
        .join(", ")}`
    );
  }

  if (safeString(booking.lifecycle_status).toLowerCase() === "completed") {
    return;
  }

  await ensureDocumentsGenerated({
    booking,
    actorType,
    actorId: input.actorId ?? null,
    idempotencyRoot,
  });
}
