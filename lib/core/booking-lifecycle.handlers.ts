import { bookingEventDispatcher } from "@/lib/core/event-dispatcher";
import { generateDocsForBooking } from "@/lib/documents/generateBookingDocs";
import { logError, logInfo } from "@/lib/backend/logger";
import { recordAutomationFailure } from "@/lib/system/automationFailures";

let initialized = false;

export function ensureBookingAutomationHandlers(): void {
  if (initialized) return;
  initialized = true;

  bookingEventDispatcher.on("booking.payment_confirmed", async (payload) => {
    try {
      const summary = await generateDocsForBooking(payload.booking.id, "payment.confirmed");

      logInfo("Document generation attempted after payment confirmation", {
        bookingId: payload.booking.id,
        generated: summary.generated,
        skipped: summary.skipped,
        failed: summary.failed.map((entry) => entry.type),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logError("Failed to run payment-confirmed document automation", {
        bookingId: payload.booking.id,
        error: message,
      });
      await recordAutomationFailure({
        bookingId: payload.booking.id,
        event: "documents.generate",
        errorMessage: message,
        payload: {
          booking_id: payload.booking.id,
        },
        meta: {
          source: "booking.lifecycle.handlers",
          handler: "booking.payment_confirmed",
        },
      });
    }
  });

  bookingEventDispatcher.on("booking.supplier_confirmed", async (payload) => {
    try {
      const summary = await generateDocsForBooking(payload.booking.id, "supplier.confirmed");

      logInfo("Document generation attempted after supplier confirmation", {
        bookingId: payload.booking.id,
        generated: summary.generated,
        skipped: summary.skipped,
        failed: summary.failed.map((entry) => entry.type),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logError("Failed to generate supplier confirmation documents", {
        bookingId: payload.booking.id,
        error: message,
      });
      await recordAutomationFailure({
        bookingId: payload.booking.id,
        event: "documents.generate",
        errorMessage: message,
        payload: {
          booking_id: payload.booking.id,
        },
        meta: {
          source: "booking.lifecycle.handlers",
          handler: "booking.supplier_confirmed",
        },
      });
    }
  });

  bookingEventDispatcher.on("booking.completed", async (payload) => {
    logInfo("Booking completed, customer communication event emitted", {
      bookingId: payload.booking.id,
      customerId: payload.booking.customer_id,
      event: "send_completion_email",
    });
  });
}
