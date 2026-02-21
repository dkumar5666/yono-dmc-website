import { NextResponse } from "next/server";
import { BookingPayload, BookingStatus } from "@/lib/backend/types";
import { createBooking, listBookings } from "@/lib/backend/store";
import {
  buildBookingCreatedNotification,
  sendNotificationStub,
} from "@/lib/backend/notifications";
import { requireAdmin } from "@/lib/backend/adminAuth";
import { validateBookingPayload } from "@/lib/backend/validation";

const bookingStatuses: BookingStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "confirmed",
  "failed",
  "cancelled",
];

export async function GET(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const status = statusParam as BookingStatus | undefined;
    if (status && !bookingStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const bookings = await listBookings({ status, from, to });
    return NextResponse.json({ bookings });
  } catch (error: unknown) {
    console.error("BOOKINGS LIST ERROR:", error);
    return NextResponse.json({ error: "Failed to list bookings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BookingPayload>;
    const safeOfferSnapshot =
      body.offerSnapshot && typeof body.offerSnapshot === "object"
        ? body.offerSnapshot
        : null;
    const payload: BookingPayload = {
      type: "flight",
      offerId: (body.offerId ?? "").trim(),
      offerSnapshot: safeOfferSnapshot,
      amount: body.amount ?? 0,
      currency: (body.currency ?? "INR").toUpperCase().slice(0, 5),
      contact: {
        name: (body.contact?.name ?? "").trim(),
        email: (body.contact?.email ?? "").trim().toLowerCase(),
        phone: (body.contact?.phone ?? "").trim(),
      },
      travelers: (body.travelers ?? []).map((traveler) => ({
        firstName: traveler.firstName?.trim() ?? "",
        lastName: traveler.lastName?.trim() ?? "",
        dob: traveler.dob?.trim(),
        gender: traveler.gender,
        passportNumber: traveler.passportNumber?.trim(),
      })),
      notes: body.notes?.trim().slice(0, 1000),
    };

    const validationError = validateBookingPayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const booking = await createBooking(payload);
    await sendNotificationStub(buildBookingCreatedNotification(booking));
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: unknown) {
    console.error("BOOKING CREATE ERROR:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
