import { promises as fs } from "node:fs";
import path from "node:path";
import { BookingRecord } from "@/lib/backend/types";

export type NotificationEvent = "booking_created" | "booking_confirmed";

export interface NotificationPayload {
  event: NotificationEvent;
  bookingId: string;
  reference: string;
  createdAt: string;
  email: {
    to: string;
    subject: string;
    text: string;
  };
  whatsapp: {
    to: string;
    message: string;
  };
}

const runtimeDir = path.join(process.cwd(), ".runtime");
const notificationsFile = path.join(runtimeDir, "notifications.json");

async function appendNotification(payload: NotificationPayload): Promise<void> {
  await fs.mkdir(runtimeDir, { recursive: true });
  let items: NotificationPayload[] = [];
  try {
    const raw = await fs.readFile(notificationsFile, "utf8");
    items = JSON.parse(raw) as NotificationPayload[];
  } catch {
    items = [];
  }

  items.push(payload);
  await fs.writeFile(notificationsFile, JSON.stringify(items, null, 2), "utf8");
}

function amountLine(booking: BookingRecord): string {
  return `${booking.currency} ${booking.amount.toLocaleString("en-IN")}`;
}

export function buildBookingCreatedNotification(
  booking: BookingRecord
): NotificationPayload {
  const text =
    `Booking created successfully.\n` +
    `Reference: ${booking.reference}\n` +
    `Status: ${booking.status}\n` +
    `Amount: ${amountLine(booking)}\n` +
    `We will notify you once payment is confirmed.`;

  return {
    event: "booking_created",
    bookingId: booking.id,
    reference: booking.reference,
    createdAt: new Date().toISOString(),
    email: {
      to: booking.contact.email,
      subject: `Booking Created - ${booking.reference}`,
      text,
    },
    whatsapp: {
      to: booking.contact.phone,
      message: text,
    },
  };
}

export function buildBookingConfirmedNotification(
  booking: BookingRecord
): NotificationPayload {
  const ticketLine =
    booking.ticketNumbers && booking.ticketNumbers.length > 0
      ? `Tickets: ${booking.ticketNumbers.join(", ")}\n`
      : "";
  const pnrLine = booking.pnr ? `PNR: ${booking.pnr}\n` : "";

  const text =
    `Your booking is confirmed.\n` +
    `Reference: ${booking.reference}\n` +
    pnrLine +
    ticketLine +
    `Amount Paid: ${amountLine(booking)}\n` +
    `Thank you for booking with Yono DMC.`;

  return {
    event: "booking_confirmed",
    bookingId: booking.id,
    reference: booking.reference,
    createdAt: new Date().toISOString(),
    email: {
      to: booking.contact.email,
      subject: `Booking Confirmed - ${booking.reference}`,
      text,
    },
    whatsapp: {
      to: booking.contact.phone,
      message: text,
    },
  };
}

export async function sendNotificationStub(
  payload: NotificationPayload
): Promise<void> {
  await appendNotification(payload);
  console.log("NOTIFICATION_STUB", payload);
}
