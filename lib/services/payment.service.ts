import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentStatus,
  PaymentWebhookPayload,
  TosPayment,
} from "@/types/tos";
import {
  SupabaseBookingLifecycleRepository,
  SupabasePaymentsRepository,
} from "@/lib/core/booking-lifecycle.repository";
import { transitionBookingLifecycle } from "@/lib/core/booking-lifecycle.engine";
import { recordAutomationFailure } from "@/lib/system/automationFailures";

interface PaymentServiceDeps {
  lifecycleRepository: SupabaseBookingLifecycleRepository;
  paymentsRepository: SupabasePaymentsRepository;
}

function resolveDeps(deps?: Partial<PaymentServiceDeps>): PaymentServiceDeps {
  return {
    lifecycleRepository:
      deps?.lifecycleRepository ?? new SupabaseBookingLifecycleRepository(),
    paymentsRepository: deps?.paymentsRepository ?? new SupabasePaymentsRepository(),
  };
}

function paymentStatusFromEvent(eventType: string): PaymentStatus {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("captured") || normalized.includes("succeeded")) return "captured";
  if (normalized.includes("authorized")) return "authorized";
  if (normalized.includes("refund")) return "refunded";
  if (normalized.includes("fail")) return "failed";
  return "requires_action";
}

function verifyHmacSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyPaymentWebhookSignature(
  provider: string,
  rawBody: string,
  headers: Headers
): boolean {
  if (provider === "razorpay") {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? process.env.PAYMENT_WEBHOOK_SECRET;
    const signature = headers.get("x-razorpay-signature") ?? headers.get("x-payment-signature");
    if (!secret || !signature) return false;
    return verifyHmacSignature(rawBody, signature, secret);
  }

  if (provider === "stripe") {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? process.env.PAYMENT_WEBHOOK_SECRET;
    const signature = headers.get("stripe-signature") ?? headers.get("x-payment-signature");
    if (!secret || !signature) return false;
    return verifyHmacSignature(rawBody, signature, secret);
  }

  const genericSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  const genericSignature = headers.get("x-payment-signature");
  if (!genericSecret || !genericSignature) return false;
  return verifyHmacSignature(rawBody, genericSignature, genericSecret);
}

function buildProviderIntentPayload(payment: TosPayment) {
  if (payment.provider === "razorpay") {
    return {
      provider: "razorpay",
      orderId: payment.provider_order_id,
      amount: payment.amount,
      currency: payment.currency_code,
      bookingId: payment.booking_id,
    };
  }

  if (payment.provider === "stripe") {
    return {
      provider: "stripe",
      clientSecret: payment.provider_payment_intent_id,
      amount: payment.amount,
      currency: payment.currency_code,
      bookingId: payment.booking_id,
    };
  }

  return {
    provider: payment.provider,
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency_code,
    bookingId: payment.booking_id,
  };
}

export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
  deps?: Partial<PaymentServiceDeps>
): Promise<CreatePaymentIntentResult> {
  const { lifecycleRepository, paymentsRepository } = resolveDeps(deps);

  const booking = await lifecycleRepository.getBookingById(input.bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${input.bookingId}`);
  }

  const amount = Number(input.amount ?? booking.due_amount ?? booking.gross_amount);
  const currencyCode = (input.currencyCode ?? booking.currency_code ?? "INR").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
  const existingPayment = await paymentsRepository.getPaymentByIdempotencyKey(idempotencyKey);
  if (existingPayment) {
    return {
      payment: existingPayment,
      providerPayload: buildProviderIntentPayload(existingPayment),
    };
  }

  const providerOrderId =
    input.provider === "razorpay" ? `order_${randomUUID().replace(/-/g, "")}` : null;
  const providerPaymentIntentId =
    input.provider === "stripe" ? `pi_${randomUUID().replace(/-/g, "")}` : null;

  const payment = await paymentsRepository.createPayment({
    id: randomUUID(),
    booking_id: booking.id,
    customer_id: input.customerId ?? booking.customer_id,
    provider: input.provider,
    idempotency_key: idempotencyKey,
    provider_order_id: providerOrderId,
    provider_payment_intent_id: providerPaymentIntentId,
    currency_code: currencyCode,
    amount,
    amount_captured: 0,
    amount_refunded: 0,
    status: "requires_action",
    raw_payload: {
      source: "api.payments.create-intent",
      bookingCode: booking.booking_code,
    },
  });

  if (booking.lifecycle_status === "booking_created") {
    await transitionBookingLifecycle({
      bookingId: booking.id,
      toStatus: "payment_pending",
      actorType: "system",
      note: "Payment intent created",
      idempotencyKey: `payment_pending:${payment.id}`,
      metadata: { paymentId: payment.id },
    });
  }

  return {
    payment,
    providerPayload: buildProviderIntentPayload(payment),
  };
}

export async function handlePaymentWebhook(
  payload: PaymentWebhookPayload,
  deps?: Partial<PaymentServiceDeps>
): Promise<{ payment: TosPayment; lifecycleChanged: boolean }> {
  const { paymentsRepository } = resolveDeps(deps);

  const existing = await paymentsRepository.getPaymentByWebhookEventId(payload.eventId);
  if (existing) {
    return { payment: existing, lifecycleChanged: false };
  }

  const payment = await paymentsRepository.getLatestPaymentByBookingId(payload.bookingId);
  const targetStatus = paymentStatusFromEvent(payload.eventType);

  const paymentId = payment?.id ?? randomUUID();
  const patched = payment
    ? await paymentsRepository.updatePayment(payment.id, {
        webhook_event_id: payload.eventId,
        provider_payment_id: payload.providerPaymentId ?? payment.provider_payment_id,
        provider_order_id: payload.providerOrderId ?? payment.provider_order_id,
        provider_payment_intent_id:
          payload.providerPaymentIntentId ?? payment.provider_payment_intent_id,
        amount_captured: payload.amountCaptured ?? payment.amount_captured,
        amount_refunded: payload.amountRefunded ?? payment.amount_refunded,
        currency_code: payload.currencyCode ?? payment.currency_code,
        status: targetStatus,
        paid_at: targetStatus === "captured" ? new Date().toISOString() : payment.paid_at,
        raw_payload: payload.rawPayload,
      })
    : await paymentsRepository.createPayment({
        id: paymentId,
        booking_id: payload.bookingId,
        provider: payload.provider,
        webhook_event_id: payload.eventId,
        provider_payment_id: payload.providerPaymentId ?? null,
        provider_order_id: payload.providerOrderId ?? null,
        provider_payment_intent_id: payload.providerPaymentIntentId ?? null,
        currency_code: payload.currencyCode ?? "INR",
        amount: payload.amountCaptured ?? 0,
        amount_captured: payload.amountCaptured ?? 0,
        amount_refunded: payload.amountRefunded ?? 0,
        status: targetStatus,
        paid_at: targetStatus === "captured" ? new Date().toISOString() : null,
        raw_payload: payload.rawPayload,
      });

  let lifecycleChanged = false;
  if (targetStatus === "captured") {
    try {
      await transitionBookingLifecycle({
        bookingId: payload.bookingId,
        toStatus: "payment_confirmed",
        actorType: "webhook",
        note: `${payload.provider} webhook: ${payload.eventType}`,
        idempotencyKey: `webhook:${payload.eventId}`,
        metadata: {
          provider: payload.provider,
          paymentId: patched.id,
        },
      });
      lifecycleChanged = true;
    } catch (error) {
      await recordAutomationFailure({
        bookingId: payload.bookingId,
        event: "payment.confirmed",
        errorMessage: error instanceof Error ? error.message : "Payment confirmed automation failed",
        payload: {
          booking_id: payload.bookingId,
          event_type: payload.eventType,
          provider: payload.provider,
          payment_id: patched.id,
        },
        meta: {
          source: "payment.webhook",
          event_id: payload.eventId,
        },
      });
      throw error;
    }
  }

  if (targetStatus === "refunded") {
    await transitionBookingLifecycle({
      bookingId: payload.bookingId,
      toStatus: "refunded",
      actorType: "webhook",
      note: `${payload.provider} webhook refund: ${payload.eventType}`,
      idempotencyKey: `webhook-refund:${payload.eventId}`,
      metadata: {
        provider: payload.provider,
        paymentId: patched.id,
        amountRefunded: patched.amount_refunded,
      },
    });
    lifecycleChanged = true;
  }

  return { payment: patched, lifecycleChanged };
}
