import { NextResponse } from "next/server";
import { BookingStatus } from "@/lib/backend/types";
import {
  getBookingById,
  transitionBookingStatus,
  updateBookingFields,
} from "@/lib/backend/store";
import { requireAdmin } from "@/lib/backend/adminAuth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = "then" in context.params ? await context.params : context.params;
    const booking = await getBookingById(params.id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json({ booking });
  } catch (error: unknown) {
    console.error("BOOKING FETCH ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}

interface BookingPatchBody {
  status?: BookingStatus;
  pnr?: string;
  ticketNumbers?: string[];
  issuedAt?: string;
  issuedBy?: string;
  cancellationReason?: string;
  notes?: string;
}

const bookingStatuses: BookingStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "confirmed",
  "failed",
  "cancelled",
];

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const params = "then" in context.params ? await context.params : context.params;
    const booking = await getBookingById(params.id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = (await req.json()) as BookingPatchBody;
    const { status, pnr, ticketNumbers, issuedAt, issuedBy, cancellationReason, notes } =
      body;

    if (status && !bookingStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid booking status" }, { status: 400 });
    }

    if (status) {
      const transition = await transitionBookingStatus(booking.id, status, {
        pnr: pnr ?? booking.pnr,
        ticketNumbers: ticketNumbers ?? booking.ticketNumbers,
        issuedAt: issuedAt ?? booking.issuedAt,
        issuedBy: issuedBy ?? booking.issuedBy,
        cancellationReason: cancellationReason ?? booking.cancellationReason,
        cancelledAt:
          status === "cancelled"
            ? booking.cancelledAt ?? new Date().toISOString()
            : booking.cancelledAt,
        notes: notes ?? booking.notes,
      });

      if (!transition.booking) {
        return NextResponse.json(
          { error: transition.error ?? "Status update failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({ booking: transition.booking });
    }

    const updated = await updateBookingFields(booking.id, {
      pnr: pnr ?? booking.pnr,
      ticketNumbers: ticketNumbers ?? booking.ticketNumbers,
      issuedAt: issuedAt ?? booking.issuedAt,
      issuedBy: issuedBy ?? booking.issuedBy,
      cancellationReason: cancellationReason ?? booking.cancellationReason,
      notes: notes ?? booking.notes,
    });

    return NextResponse.json({ booking: updated });
  } catch (error: unknown) {
    console.error("BOOKING PATCH ERROR:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
