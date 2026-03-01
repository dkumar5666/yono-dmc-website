import "server-only";

import { SupabaseRestClient } from "@/lib/core/supabase-rest";

type GenericRow = Record<string, unknown>;

export interface SupplierIdentity {
  supplierId: string;
  supplierName: string | null;
}

export interface SupplierAssignment {
  booking_id: string;
  source: "booking_items" | "ground_services" | "bookings" | "supplier_assignments";
  service_type: string | null;
  status: string | null;
  start_at: string | null;
  end_at: string | null;
}

export interface ResolvedSupplierBooking {
  booking: GenericRow | null;
  booking_id: string;
  booking_uuid: string | null;
  assigned: boolean;
  assignments: SupplierAssignment[];
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    return await db.selectMany<T>(table, query);
  } catch {
    return [];
  }
}

async function safeSelectSingle<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T | null> {
  try {
    return await db.selectSingle<T>(table, query);
  } catch {
    return null;
  }
}

function normalizeAssignment(row: GenericRow, source: SupplierAssignment["source"]): SupplierAssignment | null {
  const bookingId =
    safeString(row.booking_id) ||
    safeString(row.booking_code) ||
    safeString(row.booking_ref) ||
    safeString(row.id);
  if (!bookingId) return null;

  return {
    booking_id: bookingId,
    source,
    service_type:
      safeString(row.item_type) ||
      safeString(row.type) ||
      safeString(row.service_type) ||
      null,
    status:
      safeString(row.status) ||
      safeString(row.supplier_status) ||
      safeString(row.lifecycle_status) ||
      null,
    start_at:
      safeString(row.service_start_at) ||
      safeString(row.start_at) ||
      safeString(row.start_date) ||
      safeString(row.travel_start_date) ||
      null,
    end_at:
      safeString(row.service_end_at) ||
      safeString(row.end_at) ||
      safeString(row.end_date) ||
      safeString(row.travel_end_date) ||
      null,
  };
}

export async function resolveSupplierIdentityByUserId(
  db: SupabaseRestClient,
  userId: string
): Promise<SupplierIdentity | null> {
  const ref = safeString(userId);
  if (!ref) return null;

  const byUser = await safeSelectSingle<GenericRow>(
    db,
    "suppliers",
    new URLSearchParams({
      select: "id,trade_name,legal_name,user_id",
      user_id: `eq.${ref}`,
    })
  );
  if (byUser && safeString(byUser.id)) {
    return {
      supplierId: safeString(byUser.id),
      supplierName: safeString(byUser.trade_name) || safeString(byUser.legal_name) || null,
    };
  }

  const byId = await safeSelectSingle<GenericRow>(
    db,
    "suppliers",
    new URLSearchParams({
      select: "id,trade_name,legal_name",
      id: `eq.${ref}`,
    })
  );
  if (byId && safeString(byId.id)) {
    return {
      supplierId: safeString(byId.id),
      supplierName: safeString(byId.trade_name) || safeString(byId.legal_name) || null,
    };
  }

  // Fallback for environments where supplier_id is stored directly as auth user id.
  return {
    supplierId: ref,
    supplierName: null,
  };
}

export async function listSupplierAssignments(
  db: SupabaseRestClient,
  supplierId: string
): Promise<SupplierAssignment[]> {
  const ref = safeString(supplierId);
  if (!ref) return [];

  const out: SupplierAssignment[] = [];
  const addRows = (rows: GenericRow[], source: SupplierAssignment["source"]) => {
    for (const row of rows) {
      const normalized = normalizeAssignment(row, source);
      if (normalized) out.push(normalized);
    }
  };

  const bookingItems = await safeSelectMany<GenericRow>(
    db,
    "booking_items",
    new URLSearchParams({
      select:
        "id,booking_id,supplier_id,item_type,type,status,service_start_at,service_end_at,start_date,end_date",
      supplier_id: `eq.${ref}`,
      limit: "500",
      order: "created_at.desc",
    })
  );
  addRows(bookingItems, "booking_items");

  const groundServices = await safeSelectMany<GenericRow>(
    db,
    "ground_services",
    new URLSearchParams({
      select:
        "id,booking_id,supplier_id,service_type,status,start_at,end_at,service_start_at,service_end_at",
      supplier_id: `eq.${ref}`,
      limit: "500",
      order: "created_at.desc",
    })
  );
  addRows(groundServices, "ground_services");

  const bookingRows = await safeSelectMany<GenericRow>(
    db,
    "bookings",
    new URLSearchParams({
      select:
        "id,booking_code,supplier_id,supplier_status,lifecycle_status,travel_start_date,travel_end_date",
      supplier_id: `eq.${ref}`,
      limit: "500",
      order: "created_at.desc",
    })
  );
  addRows(bookingRows, "bookings");

  const assignmentRows = await safeSelectMany<GenericRow>(
    db,
    "supplier_assignments",
    new URLSearchParams({
      select: "id,booking_id,supplier_id,service_type,status,start_at,end_at,created_at",
      supplier_id: `eq.${ref}`,
      limit: "500",
      order: "created_at.desc",
    })
  );
  addRows(assignmentRows, "supplier_assignments");

  return out;
}

export async function resolveBookingByReference(
  db: SupabaseRestClient,
  bookingRef: string
): Promise<GenericRow | null> {
  const ref = safeString(bookingRef);
  if (!ref) return null;

  const select =
    "id,booking_code,customer_id,lifecycle_status,supplier_status,payment_status,gross_amount,total_amount,currency_code,currency,travel_start_date,travel_end_date,created_at,updated_at";

  const byCode = await safeSelectSingle<GenericRow>(
    db,
    "bookings",
    new URLSearchParams({
      select,
      booking_code: `eq.${ref}`,
    })
  );
  if (byCode) return byCode;

  if (looksLikeUuid(ref)) {
    const byId = await safeSelectSingle<GenericRow>(
      db,
      "bookings",
      new URLSearchParams({
        select,
        id: `eq.${ref}`,
      })
    );
    if (byId) return byId;
  }

  return null;
}

export async function isBookingAssignedToSupplier(
  db: SupabaseRestClient,
  supplierId: string,
  bookingRef: string,
  bookingUuid?: string | null
): Promise<boolean> {
  const supplier = safeString(supplierId);
  const booking = safeString(bookingRef);
  const bookingId = safeString(bookingUuid);
  if (!supplier || !booking) return false;

  const refs = Array.from(new Set([bookingId, booking].filter(Boolean)));

  for (const ref of refs) {
    const hasBookingItem = await safeSelectSingle<GenericRow>(
      db,
      "booking_items",
      new URLSearchParams({
        select: "id",
        booking_id: `eq.${ref}`,
        supplier_id: `eq.${supplier}`,
      })
    );
    if (hasBookingItem) return true;

    const hasGroundService = await safeSelectSingle<GenericRow>(
      db,
      "ground_services",
      new URLSearchParams({
        select: "id",
        booking_id: `eq.${ref}`,
        supplier_id: `eq.${supplier}`,
      })
    );
    if (hasGroundService) return true;

    const hasSupplierAssignment = await safeSelectSingle<GenericRow>(
      db,
      "supplier_assignments",
      new URLSearchParams({
        select: "id",
        booking_id: `eq.${ref}`,
        supplier_id: `eq.${supplier}`,
      })
    );
    if (hasSupplierAssignment) return true;
  }

  if (bookingId) {
    const bookingOwned = await safeSelectSingle<GenericRow>(
      db,
      "bookings",
      new URLSearchParams({
        select: "id",
        id: `eq.${bookingId}`,
        supplier_id: `eq.${supplier}`,
      })
    );
    if (bookingOwned) return true;
  }

  const bookingCodeOwned = await safeSelectSingle<GenericRow>(
    db,
    "bookings",
    new URLSearchParams({
      select: "id",
      booking_code: `eq.${booking}`,
      supplier_id: `eq.${supplier}`,
    })
  );
  if (bookingCodeOwned) return true;

  return false;
}

export async function resolveSupplierBooking(
  db: SupabaseRestClient,
  supplierId: string,
  bookingRef: string
): Promise<ResolvedSupplierBooking> {
  const booking = await resolveBookingByReference(db, bookingRef);
  const bookingUuid = booking ? safeString(booking.id) || null : null;
  const normalizedBookingRef = booking
    ? safeString(booking.booking_code) || safeString(booking.id) || safeString(bookingRef)
    : safeString(bookingRef);

  const assigned = await isBookingAssignedToSupplier(
    db,
    supplierId,
    normalizedBookingRef || bookingRef,
    bookingUuid
  );

  const assignments = assigned
    ? (await listSupplierAssignments(db, supplierId)).filter((entry) => {
        const entryBookingId = safeString(entry.booking_id);
        if (!entryBookingId) return false;
        if (bookingUuid && entryBookingId === bookingUuid) return true;
        return entryBookingId === normalizedBookingRef || entryBookingId === safeString(bookingRef);
      })
    : [];

  return {
    booking,
    booking_id: normalizedBookingRef || safeString(bookingRef),
    booking_uuid: bookingUuid,
    assigned,
    assignments,
  };
}

