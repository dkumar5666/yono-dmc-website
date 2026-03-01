import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import {
  resolveSupplierBooking,
  resolveSupplierIdentityByUserId,
} from "@/lib/supplier/assignmentResolver";
import { routeError } from "@/lib/middleware/routeError";

type GenericRow = Record<string, unknown>;
type Params = { booking_id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

async function queryBookingScopedRows(
  db: SupabaseRestClient,
  table: string,
  bookingRefs: string[],
  select: string,
  extra: Record<string, string> = {}
): Promise<GenericRow[]> {
  for (const bookingId of bookingRefs) {
    if (!bookingId) continue;
    const query = new URLSearchParams({
      select,
      booking_id: `eq.${bookingId}`,
      order: "created_at.desc",
      limit: "200",
      ...extra,
    });
    const rows = await safeSelectMany<GenericRow>(db, table, query);
    if (rows.length > 0) return rows;
  }
  return [];
}

function customerName(row: GenericRow | null): string | null {
  if (!row) return null;
  const full = [safeString(row.first_name), safeString(row.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || safeString(row.email) || null;
}

function normalizeBooking(row: GenericRow) {
  return {
    booking_id: safeString(row.booking_code) || safeString(row.id) || null,
    booking_uuid: safeString(row.id) || null,
    status: safeString(row.lifecycle_status) || safeString(row.status) || null,
    payment_status: safeString(row.payment_status) || null,
    supplier_status: safeString(row.supplier_status) || null,
    total_amount: toNumber(row.gross_amount ?? row.total_amount),
    currency: safeString(row.currency_code) || safeString(row.currency) || null,
    created_at: safeString(row.created_at) || null,
    updated_at: safeString(row.updated_at) || null,
    travel_start_date: safeString(row.travel_start_date) || null,
    travel_end_date: safeString(row.travel_end_date) || null,
  };
}

export async function GET(req: Request, { params }: { params: Params | Promise<Params> }) {
  const auth = requireRole(req, "supplier");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const resolvedParams = "then" in params ? await params : params;
    const bookingRef = decodeURIComponent(resolvedParams.booking_id ?? "").trim();
    if (!bookingRef) {
      return NextResponse.json({
        booking: null,
        customer: null,
        items: [],
        ground_services: [],
        supplier_logs: [],
        invoices: [],
        assignments: [],
      });
    }

    const db = new SupabaseRestClient();
    const supplier = await resolveSupplierIdentityByUserId(db, auth.userId);
    if (!supplier?.supplierId) return routeError(403, "Not authorized");

    const resolved = await resolveSupplierBooking(db, supplier.supplierId, bookingRef);
    if (!resolved.booking || !resolved.assigned) return routeError(404, "Booking not found");

    const booking = normalizeBooking(resolved.booking);
    const bookingRefs = Array.from(
      new Set([safeString(booking.booking_uuid), safeString(booking.booking_id), bookingRef].filter(Boolean))
    );

    const customer =
      safeString(resolved.booking.customer_id)
        ? await safeSelectMany<GenericRow>(
            db,
            "customers",
            new URLSearchParams({
              select: "id,first_name,last_name,email,phone",
              id: `eq.${safeString(resolved.booking.customer_id)}`,
              limit: "1",
            })
          ).then((rows) => rows[0] ?? null)
        : null;

    const [bookingItems, groundServices, supplierLogs, invoices] = await Promise.all([
      queryBookingScopedRows(
        db,
        "booking_items",
        bookingRefs,
        "id,booking_id,item_type,type,title,status,service_start_at,service_end_at,start_date,end_date,total_amount,amount,currency_code,currency,quantity,qty,metadata,supplier_id",
        { supplier_id: `eq.${supplier.supplierId}` }
      ),
      queryBookingScopedRows(
        db,
        "ground_services",
        bookingRefs,
        "id,booking_id,service_type,status,start_at,end_at,service_start_at,service_end_at,amount,currency_code,currency,notes,metadata,supplier_id",
        { supplier_id: `eq.${supplier.supplierId}` }
      ),
      queryBookingScopedRows(
        db,
        "supplier_logs",
        bookingRefs,
        "id,booking_id,supplier_id,supplier,action,status,message,payload,created_at",
      ),
      queryBookingScopedRows(
        db,
        "documents",
        bookingRefs,
        "id,booking_id,type,name,url,public_url,file_url,status,created_at,supplier_id",
        { type: "eq.supplier_invoice" }
      ),
    ]);

    const filteredSupplierLogs = supplierLogs.filter((row) => {
      const supplierId = safeString(row.supplier_id);
      return !supplierId || supplierId === supplier.supplierId;
    });

    const filteredInvoices = invoices.filter((row) => {
      const supplierId = safeString(row.supplier_id);
      return !supplierId || supplierId === supplier.supplierId;
    });

    return NextResponse.json({
      booking,
      customer: {
        id: safeString(customer?.id) || null,
        name: customerName(customer),
        email: safeString(customer?.email) || null,
        phone: safeString(customer?.phone) || null,
      },
      items: bookingItems.map((row) => ({
        id: safeString(row.id) || null,
        booking_id: safeString(row.booking_id) || null,
        type: safeString(row.item_type) || safeString(row.type) || null,
        title: safeString(row.title) || null,
        status: safeString(row.status) || null,
        start_at:
          safeString(row.service_start_at) || safeString(row.start_date) || null,
        end_at: safeString(row.service_end_at) || safeString(row.end_date) || null,
        amount: toNumber(row.total_amount ?? row.amount),
        currency: safeString(row.currency_code) || safeString(row.currency) || null,
        qty: toNumber(row.quantity ?? row.qty),
        meta: row.metadata ?? null,
      })),
      ground_services: groundServices.map((row) => ({
        id: safeString(row.id) || null,
        booking_id: safeString(row.booking_id) || null,
        service_type: safeString(row.service_type) || null,
        status: safeString(row.status) || null,
        start_at: safeString(row.service_start_at) || safeString(row.start_at) || null,
        end_at: safeString(row.service_end_at) || safeString(row.end_at) || null,
        amount: toNumber(row.amount),
        currency: safeString(row.currency_code) || safeString(row.currency) || null,
        notes: safeString(row.notes) || null,
        meta: row.metadata ?? null,
      })),
      supplier_logs: filteredSupplierLogs.map((row) => ({
        id: safeString(row.id) || null,
        booking_id: safeString(row.booking_id) || null,
        supplier: safeString(row.supplier) || safeString(row.supplier_id) || null,
        action: safeString(row.action) || null,
        status: safeString(row.status) || null,
        message: safeString(row.message) || null,
        created_at: safeString(row.created_at) || null,
        payload: row.payload ?? null,
      })),
      invoices: filteredInvoices.map((row) => ({
        id: safeString(row.id) || null,
        booking_id: safeString(row.booking_id) || null,
        type: safeString(row.type) || null,
        name: safeString(row.name) || null,
        url: safeString(row.public_url) || safeString(row.url) || safeString(row.file_url) || null,
        status: safeString(row.status) || null,
        created_at: safeString(row.created_at) || null,
      })),
      assignments: resolved.assignments,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({
        booking: null,
        customer: null,
        items: [],
        ground_services: [],
        supplier_logs: [],
        invoices: [],
        assignments: [],
      });
    }
    return routeError(500, "Failed to load supplier booking");
  }
}

