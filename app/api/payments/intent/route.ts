import { NextResponse } from "next/server";
import {
  createPaymentIntent,
  getBookingById,
  transitionBookingStatus,
} from "@/lib/backend/store";
import { getPaymentProvider } from "@/lib/backend/paymentProvider";

interface CreatePaymentIntentBody {
  bookingId?: string;
  amount?: number;
  currency?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreatePaymentIntentBody;
    const bookingId = body.bookingId ?? "";

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
    }

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status === "confirmed" || booking.status === "cancelled") {
      return NextResponse.json(
        { error: `Cannot create payment intent for ${booking.status} booking` },
        { status: 400 }
      );
    }

    const amount = body.amount ?? booking.amount;
    const currency = body.currency ?? booking.currency;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (amount !== booking.amount || currency !== booking.currency) {
      return NextResponse.json(
        { error: "Amount/currency mismatch with booking" },
        { status: 400 }
      );
    }

    const provider = getPaymentProvider();
    const providerIntent = await provider.createIntent({
      bookingId: booking.id,
      amount,
      currency,
    });

    const intent = await createPaymentIntent({
      bookingId: booking.id,
      amount,
      currency,
    });

    const transition = await transitionBookingStatus(booking.id, "pending_payment", {
      paymentIntentId: intent.id,
    });
    if (!transition.booking) {
      return NextResponse.json(
        { error: transition.error ?? "Failed to update booking state" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      paymentIntent: intent,
      booking: transition.booking,
      provider: {
        name: providerIntent.provider,
        clientSecret: providerIntent.providerClientSecret,
      },
      message: "Use /api/payments/confirm to complete booking after payment.",
    });
  } catch (error: unknown) {
    console.error("PAYMENT INTENT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
