import { apiSuccess } from "@/lib/backend/http";
import { createPaymentIntent } from "@/lib/services/payment.service";
import { PaymentProvider } from "@/types/tos";
import { requireRole } from "@/lib/middleware/requireRole";
import { verifyBookingOwnership } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";
import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/system/opsTelemetry";

interface CreateIntentBody {
  bookingId?: string;
  amount?: number;
  currencyCode?: string;
  provider?: PaymentProvider;
  idempotencyKey?: string;
  customerId?: string;
}

function isProvider(value: string): value is PaymentProvider {
  return ["razorpay", "stripe", "manual", "bank_transfer"].includes(value);
}

export async function POST(req: Request) {
  const auth = requireRole(req, ["customer", "agent", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json()) as CreateIntentBody;
    const bookingId = (body.bookingId ?? "").trim();
    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId is required." }, { status: 400 });
    }
    const ownershipError = await verifyBookingOwnership({
      bookingId,
      role: auth.role,
      userId: auth.userId,
    });
    if (ownershipError) return ownershipError;

    const provider = body.provider ?? "razorpay";
    if (!isProvider(provider)) {
      return NextResponse.json({ success: false, error: "Invalid payment provider." }, { status: 400 });
    }

    const result = await createPaymentIntent({
      bookingId,
      amount: body.amount,
      currencyCode: body.currencyCode,
      provider,
      idempotencyKey: body.idempotencyKey,
      customerId: auth.role === "admin" ? body.customerId : undefined,
    });
    await recordAnalyticsEvent({
      event: "payment_initiated",
      bookingId,
      paymentId: result.payment?.id ?? null,
      source: provider,
      status: result.payment?.status ?? "created",
    });

    return apiSuccess(req, result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Supabase is not configured")) {
      return routeError(500, "Supabase is not configured.");
    }
    if (message.includes("Booking not found")) {
      return routeError(404, "Booking not found");
    }
    if (message.includes("Invalid payment amount")) {
      return NextResponse.json({ success: false, error: "Invalid payment amount." }, { status: 400 });
    }
    return routeError(500, "Failed to create payment intent");
  }
}

