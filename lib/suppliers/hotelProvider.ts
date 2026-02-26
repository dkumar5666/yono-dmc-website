import crypto from "node:crypto";

import type { BookingRecord } from "@/lib/backend/types";

export interface HotelBookingExecutionInput {
  booking: BookingRecord;
  hotelOffer: Record<string, unknown>;
  guestDetails: Array<Record<string, unknown>>;
}

export interface HotelBookingExecutionResult {
  confirmationNumber: string;
  supplierBookingId: string;
  status: "confirmed";
  rawResponse: Record<string, unknown>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hashToken(value: unknown): string {
  try {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(value ?? null))
      .digest("hex");
  } catch {
    return crypto.createHash("sha256").update(String(Date.now())).digest("hex");
  }
}

function extractHotelOfferRef(hotelOffer: Record<string, unknown>): string {
  return (
    safeString(hotelOffer.offerId) ||
    safeString(hotelOffer.rateKey) ||
    safeString(hotelOffer.roomKey) ||
    safeString(hotelOffer.id) ||
    hashToken(hotelOffer).slice(0, 16)
  );
}

/**
 * Placeholder supplier booking adapter.
 * Replace the body with real hotel supplier API execution when provider credentials/SDK are connected.
 */
export async function bookHotel(
  input: HotelBookingExecutionInput
): Promise<HotelBookingExecutionResult> {
  const ref = extractHotelOfferRef(input.hotelOffer);
  const digest = hashToken({
    bookingId: input.booking.id,
    ref,
    guests: input.guestDetails.length,
  });

  const confirmationNumber = `HTL-${digest.slice(0, 10).toUpperCase()}`;
  const supplierBookingId = `hp_${digest.slice(10, 26)}`;

  const rawResponse = {
    provider: "hotel_provider",
    simulated: true,
    status: "confirmed",
    confirmationNumber,
    supplierBookingId,
    offerRef: ref,
    guestCount: input.guestDetails.length,
    createdAt: new Date().toISOString(),
  };

  return {
    confirmationNumber,
    supplierBookingId,
    status: "confirmed",
    rawResponse,
  };
}

