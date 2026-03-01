import crypto from "node:crypto";
import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  handlePaymentWebhook,
  verifyPaymentWebhookSignature,
} from "@/lib/services/payment.service";
import { PaymentProvider } from "@/types/tos";
import { writeHeartbeat } from "@/lib/system/heartbeat";
import { acquireWebhookLock, markWebhookEvent } from "@/lib/system/webhookLock";
import { recordAnalyticsEvent, recordRouteDuration } from "@/lib/system/opsTelemetry";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getNestedString(obj: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

function getNestedNumber(obj: Record<string, unknown>, path: string[]): number | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" ? current : undefined;
}

function normalizeProvider(value: string | null): PaymentProvider | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "razorpay") return "razorpay";
  if (normalized === "stripe") return "stripe";
  if (normalized === "manual") return "manual";
  if (normalized === "bank_transfer") return "bank_transfer";
  return null;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  let perfStatusCode = 500;
  let perfOutcome: "success" | "fail" | "warn" = "fail";
  const finalize = (response: Response, outcome: "success" | "fail" | "warn"): Response => {
    perfStatusCode = response.status;
    perfOutcome = outcome;
    return response;
  };

  let webhookProviderForMark = "razorpay";
  let webhookEventIdForMark: string | null = null;
  let webhookEventTypeForMark: string | null = null;
  let webhookPayloadForMark: Record<string, unknown> | null = null;
  let webhookBookingIdForMark: string | null = null;
  let webhookPaymentIdForMark: string | null = null;

  try {
    const requestUrl = new URL(req.url);
    const provider =
      normalizeProvider(requestUrl.searchParams.get("provider")) ??
      normalizeProvider(req.headers.get("x-payment-provider")) ??
      "razorpay";
    webhookProviderForMark = provider;

    const rawBody = await req.text();
    if (!verifyPaymentWebhookSignature(provider, rawBody, req.headers)) {
      return finalize(
        apiError(req, 401, "INVALID_WEBHOOK_SIGNATURE", "Invalid webhook signature."),
        "warn"
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return finalize(apiError(req, 400, "INVALID_JSON", "Invalid webhook JSON payload."), "warn");
    }

    const payload = asRecord(parsed);
    webhookPayloadForMark = payload;
    const eventId =
      req.headers.get("x-razorpay-event-id")?.trim() ||
      getNestedString(payload, ["eventId"]) ||
      getNestedString(payload, ["id"]) ||
      getNestedString(payload, ["payload", "payment", "entity", "id"]) ||
      `evt_hash_${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
    const eventType =
      getNestedString(payload, ["eventType"]) ??
      getNestedString(payload, ["event"]) ??
      getNestedString(payload, ["type"]) ??
      "payment.updated";
    webhookEventIdForMark = eventId;
    webhookEventTypeForMark = eventType;

    const lockResult = await acquireWebhookLock(provider, eventId, payload);
    if (lockResult.skipped) {
      await writeHeartbeat("payment_webhook", { received: true, lock: "skipped_duplicate" });
      return finalize(apiSuccess(req, { ok: true, skipped: true }, 200), "warn");
    }
    if (!lockResult.ok) {
      await writeHeartbeat("payment_webhook", {
        received: true,
        lock: "failed",
        reason: lockResult.reason ?? "unknown",
      });
      console.warn("webhook lock unavailable; continuing processing", {
        provider,
        reason: lockResult.reason ?? "unknown",
      });
    } else {
      await writeHeartbeat("payment_webhook", { received: true, lock: "acquired" });
    }

    const bookingId =
      getNestedString(payload, ["bookingId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "notes", "bookingId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "notes", "booking_id"]);
    webhookBookingIdForMark = bookingId ?? null;

    if (!bookingId) {
      if (webhookEventIdForMark) {
        await markWebhookEvent(provider, eventId, {
          status: "failed",
          event_type: eventType,
          payload: { error: "BOOKING_ID_MISSING" },
        });
      }
      return finalize(
        apiError(req, 400, "BOOKING_ID_MISSING", "bookingId is required in webhook payload."),
        "warn"
      );
    }

    const providerPaymentId =
      getNestedString(payload, ["providerPaymentId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "id"]);
    webhookPaymentIdForMark = providerPaymentId ?? null;
    const providerOrderId =
      getNestedString(payload, ["providerOrderId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "order_id"]);
    const providerPaymentIntentId = getNestedString(payload, ["providerPaymentIntentId"]);

    const amountCaptured =
      getNestedNumber(payload, ["amountCaptured"]) ??
      getNestedNumber(payload, ["amount"]) ??
      getNestedNumber(payload, ["payload", "payment", "entity", "amount"]);
    const amountRefunded =
      getNestedNumber(payload, ["amountRefunded"]) ??
      getNestedNumber(payload, ["payload", "refund", "entity", "amount"]);

    const result = await handlePaymentWebhook({
      provider,
      eventId,
      eventType,
      bookingId,
      providerPaymentId,
      providerOrderId,
      providerPaymentIntentId,
      amountCaptured,
      amountRefunded,
      currencyCode:
        getNestedString(payload, ["currencyCode"]) ??
        getNestedString(payload, ["payload", "payment", "entity", "currency"]),
      rawPayload: payload,
    });
    await recordAnalyticsEvent({
      event: "payment_success",
      bookingId,
      paymentId: providerPaymentId ?? result.payment?.id ?? null,
      source: provider,
      status: result.payment?.status ?? "processed",
      meta: {
        lifecycle_changed: result.lifecycleChanged,
      },
    });

    if (webhookEventIdForMark) {
      await markWebhookEvent(provider, eventId, {
        status: "processed",
        event_type: eventType,
        booking_id: bookingId,
        payment_id: providerPaymentId ?? null,
      });
    }

    return finalize(apiSuccess(req, result, 200), "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (webhookEventIdForMark) {
      await markWebhookEvent(webhookProviderForMark, webhookEventIdForMark, {
        status: "failed",
        event_type: webhookEventTypeForMark,
        booking_id: webhookBookingIdForMark,
        payment_id: webhookPaymentIdForMark,
        payload: {
          ...(webhookPayloadForMark ? { source_payload: webhookPayloadForMark } : {}),
          error_message: message,
        },
      });
    }
    if (message.includes("Supabase is not configured")) {
      return finalize(
        apiError(
          req,
          503,
          "SUPABASE_NOT_CONFIGURED",
          "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        ),
        "fail"
      );
    }

    if (message.includes("Booking not found")) {
      return finalize(apiError(req, 404, "BOOKING_NOT_FOUND", message), "warn");
    }

    return finalize(
      apiError(req, 500, "PAYMENT_WEBHOOK_FAILED", "Failed to process payment webhook.", {
        message,
      }),
      "fail"
    );
  } finally {
    await recordRouteDuration({
      route: "/api/payments/webhook",
      durationMs: Date.now() - startedAt,
      statusCode: perfStatusCode,
      outcome: perfOutcome,
    });
  }
}
