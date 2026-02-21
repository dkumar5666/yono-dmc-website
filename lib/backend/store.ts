import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  BookingListFilters,
  BookingPayload,
  BookingRecord,
  BookingStatusEvent,
  BookingStatus,
  BookingStatusTransitionResult,
  PaymentIntentRecord,
  PaymentStatus,
} from "@/lib/backend/types";

interface DbSchema {
  bookings: BookingRecord[];
  payments: PaymentIntentRecord[];
}

const runtimeDir = path.join(process.cwd(), ".runtime");
const dbFile = path.join(runtimeDir, "bookings.json");

let writeQueue: Promise<void> = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

const statusTransitions: Record<BookingStatus, BookingStatus[]> = {
  draft: ["pending_payment", "cancelled", "failed"],
  pending_payment: ["paid", "confirmed", "failed", "cancelled"],
  paid: ["confirmed", "failed", "cancelled"],
  confirmed: ["cancelled"],
  failed: [],
  cancelled: [],
};

function canTransitionStatus(
  current: BookingStatus,
  next: BookingStatus
): boolean {
  if (current === next) return true;
  return statusTransitions[current].includes(next);
}

function normalizeLegacyStatus(status: string): BookingStatus {
  if (status === "initiated") return "draft";
  if (status === "payment_received") return "paid";
  if (
    status === "draft" ||
    status === "pending_payment" ||
    status === "paid" ||
    status === "confirmed" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "draft";
}

function timestampFieldByStatus(status: BookingStatus): keyof BookingRecord | null {
  if (status === "draft") return "draftAt";
  if (status === "pending_payment") return "pendingPaymentAt";
  if (status === "paid") return "paidAt";
  if (status === "confirmed") return "confirmedAt";
  if (status === "failed") return "failedAt";
  if (status === "cancelled") return "cancelledAt";
  return null;
}

function normalizeBookingRecord(record: BookingRecord): BookingRecord {
  const normalizedStatus = normalizeLegacyStatus(record.status);
  if (normalizedStatus === record.status) return record;
  return {
    ...record,
    status: normalizedStatus,
  };
}

function appendStatusEvent(
  booking: BookingRecord,
  status: BookingStatus,
  at: string
): BookingStatusEvent[] {
  const existing = booking.statusTimeline ?? [];
  const last = existing[existing.length - 1];
  if (last && last.status === status) return existing;
  return [...existing, { status, at }];
}

function createBookingReference(): string {
  const stamp = Date.now().toString().slice(-8);
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `YONO-${stamp}-${rand}`;
}

async function ensureDbFile(): Promise<void> {
  await fs.mkdir(runtimeDir, { recursive: true });
  try {
    await fs.access(dbFile);
  } catch {
    const empty: DbSchema = { bookings: [], payments: [] };
    await fs.writeFile(dbFile, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readDb(): Promise<DbSchema> {
  await ensureDbFile();
  const content = await fs.readFile(dbFile, "utf8");
  return JSON.parse(content) as DbSchema;
}

async function writeDb(data: DbSchema): Promise<void> {
  await fs.writeFile(dbFile, JSON.stringify(data, null, 2), "utf8");
}

async function enqueueWrite<T>(job: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(job, job);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function createBooking(payload: BookingPayload): Promise<BookingRecord> {
  return enqueueWrite(async () => {
    const db = await readDb();
    const timestamp = nowIso();

    const booking: BookingRecord = {
      id: crypto.randomUUID(),
      reference: createBookingReference(),
      type: payload.type,
      status: "draft",
      amount: payload.amount,
      currency: payload.currency,
      contact: payload.contact,
      travelers: payload.travelers,
      offerId: payload.offerId,
      offerSnapshot: payload.offerSnapshot,
      draftAt: timestamp,
      statusTimeline: [{ status: "draft", at: timestamp }],
      notes: payload.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    db.bookings.push(booking);
    await writeDb(db);
    return booking;
  });
}

export async function listBookings(
  filters?: BookingListFilters
): Promise<BookingRecord[]> {
  const db = await readDb();
  let bookings = db.bookings.map(normalizeBookingRecord);

  if (filters?.status) {
    bookings = bookings.filter((booking) => booking.status === filters.status);
  }

  if (filters?.from) {
    const from = new Date(filters.from).getTime();
    if (Number.isFinite(from)) {
      bookings = bookings.filter(
        (booking) => new Date(booking.createdAt).getTime() >= from
      );
    }
  }

  if (filters?.to) {
    const to = new Date(filters.to).getTime();
    if (Number.isFinite(to)) {
      bookings = bookings.filter(
        (booking) => new Date(booking.createdAt).getTime() <= to
      );
    }
  }

  return bookings
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getBookingById(id: string): Promise<BookingRecord | null> {
  const db = await readDb();
  const booking = db.bookings.find((item) => item.id === id);
  return booking ? normalizeBookingRecord(booking) : null;
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  extra?: Partial<BookingRecord>
): Promise<BookingRecord | null> {
  return enqueueWrite(async () => {
    const db = await readDb();
    const index = db.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) return null;

    const current = normalizeBookingRecord(db.bookings[index]);
    const timestamp = nowIso();
    const stampField = timestampFieldByStatus(status);
    const statusTimeline = appendStatusEvent(current, status, timestamp);
    const updated: BookingRecord = {
      ...current,
      ...extra,
      status,
      ...(stampField ? { [stampField]: timestamp } : {}),
      statusTimeline,
      updatedAt: timestamp,
    };

    db.bookings[index] = updated;
    await writeDb(db);
    return updated;
  });
}

export async function updateBookingFields(
  id: string,
  extra: Partial<BookingRecord>
): Promise<BookingRecord | null> {
  return enqueueWrite(async () => {
    const db = await readDb();
    const index = db.bookings.findIndex((booking) => booking.id === id);
    if (index < 0) return null;

    const current = normalizeBookingRecord(db.bookings[index]);
    const updated: BookingRecord = {
      ...current,
      ...extra,
      updatedAt: nowIso(),
    };

    db.bookings[index] = updated;
    await writeDb(db);
    return updated;
  });
}

export async function transitionBookingStatus(
  id: string,
  nextStatus: BookingStatus,
  extra?: Partial<BookingRecord>
): Promise<BookingStatusTransitionResult> {
  const booking = await getBookingById(id);
  if (!booking) {
    return { booking: null, error: "Booking not found" };
  }

  if (!canTransitionStatus(booking.status, nextStatus)) {
    return {
      booking: null,
      error: `Invalid status transition from '${booking.status}' to '${nextStatus}'`,
    };
  }

  const updated = await updateBookingStatus(id, nextStatus, extra);
  return { booking: updated };
}

export async function createPaymentIntent(params: {
  bookingId: string;
  amount: number;
  currency: string;
}): Promise<PaymentIntentRecord> {
  return enqueueWrite(async () => {
    const db = await readDb();
    const timestamp = nowIso();

    const paymentIntent: PaymentIntentRecord = {
      id: `pay_${crypto.randomBytes(8).toString("hex")}`,
      bookingId: params.bookingId,
      amount: params.amount,
      currency: params.currency,
      status: "requires_action",
      provider: "manual",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    db.payments.push(paymentIntent);
    await writeDb(db);
    return paymentIntent;
  });
}

export async function getPaymentIntentById(
  id: string
): Promise<PaymentIntentRecord | null> {
  const db = await readDb();
  return db.payments.find((payment) => payment.id === id) ?? null;
}

export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  providerPaymentId?: string
): Promise<PaymentIntentRecord | null> {
  return enqueueWrite(async () => {
    const db = await readDb();
    const index = db.payments.findIndex((payment) => payment.id === id);
    if (index < 0) return null;

    const current = db.payments[index];
    const updated: PaymentIntentRecord = {
      ...current,
      status,
      providerPaymentId: providerPaymentId ?? current.providerPaymentId,
      updatedAt: nowIso(),
    };

    db.payments[index] = updated;
    await writeDb(db);
    return updated;
  });
}
