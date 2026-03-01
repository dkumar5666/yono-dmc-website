import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

type Params = { booking_id: string };

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  customer_id?: string | null;
  lifecycle_status?: string | null;
  supplier_status?: string | null;
  payment_status?: string | null;
  gross_amount?: number | string | null;
  currency_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CustomerRow {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface BookingItemRow {
  id?: string | null;
  booking_id?: string | null;
  product_id?: string | null;
  supplier_id?: string | null;
  item_type?: string | null;
  status?: string | null;
  currency_code?: string | null;
  quantity?: number | string | null;
  total_amount?: number | string | null;
  service_start_at?: string | null;
  service_end_at?: string | null;
  external_item_id?: string | null;
  metadata?: unknown;
  raw_provider_payload?: unknown;
}

interface ProductRow {
  id?: string | null;
  name?: string | null;
}

interface SupplierRow {
  id?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
}

interface PaymentRow {
  id?: string | null;
  booking_id?: string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  status?: string | null;
  provider?: string | null;
  created_at?: string | null;
  raw_payload?: unknown;
}

interface DocumentRow {
  id?: string | null;
  booking_id?: string | null;
  type?: string | null;
  status?: string | null;
  url?: string | null;
  file_url?: string | null;
  public_url?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  created_at?: string | null;
  metadata?: unknown;
}

type GenericRow = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

async function resolveBooking(db: SupabaseRestClient, bookingIdentifier: string): Promise<BookingRow | null> {
  const selectFields =
    "id,booking_code,customer_id,lifecycle_status,supplier_status,payment_status,gross_amount,currency_code,created_at,updated_at";

  const byCodeQuery = new URLSearchParams();
  byCodeQuery.set("select", selectFields);
  byCodeQuery.set("booking_code", `eq.${bookingIdentifier}`);
  const byCode = await safeSelectSingle<BookingRow>(db, "bookings", byCodeQuery);
  if (byCode) return byCode;

  if (looksLikeUuid(bookingIdentifier)) {
    const byIdQuery = new URLSearchParams();
    byIdQuery.set("select", selectFields);
    byIdQuery.set("id", `eq.${bookingIdentifier}`);
    return safeSelectSingle<BookingRow>(db, "bookings", byIdQuery);
  }

  return null;
}

function formatCustomerName(customer?: CustomerRow | null): string | null {
  if (!customer) return null;
  const full = [safeString(customer.first_name), safeString(customer.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || safeString(customer.email) || null;
}

function deriveDocumentName(row: DocumentRow): string {
  const meta = toJsonObject(row.metadata);
  const candidates = [
    meta?.name,
    meta?.title,
    meta?.file_name,
    meta?.filename,
    row.storage_path,
  ];

  for (const candidate of candidates) {
    const value = safeString(candidate);
    if (!value) continue;
    if (candidate === row.storage_path) {
      const parts = value.split("/").filter(Boolean);
      return parts[parts.length - 1] || value;
    }
    return value;
  }

  const type = safeString(row.type) || "document";
  return `${type} document`;
}

function deriveItemTitle(meta: Record<string, unknown> | null, fallbackTitle: string | null): string | null {
  const direct =
    safeString(meta?.title) ||
    safeString(meta?.name) ||
    fallbackTitle;
  if (direct) return direct;

  const segments = Array.isArray(meta?.segments) ? meta?.segments : [];
  if (segments.length > 0) {
    const first = segments[0] && typeof segments[0] === "object" ? (segments[0] as Record<string, unknown>) : null;
    const lastRaw = segments[segments.length - 1];
    const last = lastRaw && typeof lastRaw === "object" ? (lastRaw as Record<string, unknown>) : null;
    const from = safeString(first?.from);
    const to = safeString(last?.to);
    if (from && to) return `Flight ${from}-${to}`;
  }

  return null;
}

function deriveSupplierName(
  mapValue: string | null,
  meta: Record<string, unknown> | null
): string | null {
  return (
    safeString(mapValue) ||
    safeString(meta?.supplier_name) ||
    safeString(meta?.supplier) ||
    safeString(meta?.airline) ||
    null
  );
}

function normalizeSupplierLogRow(row: GenericRow) {
  return {
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_id) || null,
    supplier:
      safeString(row.supplier_name) ||
      safeString(row.supplier) ||
      safeString(row.supplier_code) ||
      safeString(row.supplier_id) ||
      null,
    action: safeString(row.action) || safeString(row.event_name) || safeString(row.event) || null,
    status: safeString(row.status) || safeString(row.level) || null,
    message: safeString(row.message) || safeString(row.note) || safeString(row.reason) || null,
    created_at: safeString(row.created_at) || null,
    payload:
      row.payload ??
      row.raw_payload ??
      row.metadata ??
      row.response_payload ??
      row.request_payload ??
      null,
  };
}

function normalizeTimelineRowsFromGeneric(rows: GenericRow[]) {
  return rows.map((row) => ({
    id: safeString(row.id) || null,
    booking_id: safeString(row.booking_id) || null,
    event: safeString(row.event_name) || safeString(row.event) || safeString(row.action) || "event",
    status: safeString(row.status) || safeString(row.to_status) || safeString(row.level) || null,
    message: safeString(row.message) || safeString(row.note) || safeString(row.reason) || null,
    created_at: safeString(row.created_at) || null,
  }));
}

function fallbackTimeline(bookingIdentifier: string, booking: BookingRow) {
  const timeline: Array<{
    id: string | null;
    booking_id: string;
    event: string;
    status: string | null;
    message: string | null;
    created_at: string | null;
  }> = [];

  if (booking.created_at) {
    timeline.push({
      id: null,
      booking_id: bookingIdentifier,
      event: "booking_created",
      status: safeString(booking.lifecycle_status) || null,
      message: "Booking record created",
      created_at: booking.created_at,
    });
  }

  if (safeString(booking.payment_status)) {
    timeline.push({
      id: null,
      booking_id: bookingIdentifier,
      event: "payment_status",
      status: safeString(booking.payment_status),
      message: null,
      created_at: booking.updated_at ?? booking.created_at ?? null,
    });
  }

  if (safeString(booking.supplier_status)) {
    timeline.push({
      id: null,
      booking_id: bookingIdentifier,
      event: "supplier_status",
      status: safeString(booking.supplier_status),
      message: null,
      created_at: booking.updated_at ?? booking.created_at ?? null,
    });
  }

  if (safeString(booking.lifecycle_status)) {
    timeline.push({
      id: null,
      booking_id: bookingIdentifier,
      event: "lifecycle_status",
      status: safeString(booking.lifecycle_status),
      message: null,
      created_at: booking.updated_at ?? booking.created_at ?? null,
    });
  }

  return timeline;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in params ? await params : params;
    const bookingIdentifier = decodeURIComponent(resolved.booking_id ?? "").trim();
    if (!bookingIdentifier) {
      return NextResponse.json({
        booking: null,
        items: [],
        payments: [],
        documents: [],
        supplier_logs: [],
        timeline: [],
      });
    }

    const db = new SupabaseRestClient();
    const booking = await resolveBooking(db, bookingIdentifier);

    if (!booking) {
      return NextResponse.json({
        booking: null,
        items: [],
        payments: [],
        documents: [],
        supplier_logs: [],
        timeline: [],
      });
    }

    const bookingUuid = safeString(booking.id) || null;

    const customer = booking.customer_id
      ? await safeSelectSingle<CustomerRow>(db, "customers", new URLSearchParams({
          select: "id,first_name,last_name,email,phone",
          id: `eq.${booking.customer_id}`,
        }))
      : null;

    const bookingPayload = {
      booking_id: safeString(booking.booking_code) || safeString(booking.id) || bookingIdentifier,
      status:
        safeString(booking.lifecycle_status) || safeString(booking.supplier_status) || null,
      payment_status: safeString(booking.payment_status) || null,
      total_amount: toNumber(booking.gross_amount),
      currency: safeString(booking.currency_code) || null,
      created_at: booking.created_at ?? null,
      updated_at: booking.updated_at ?? null,
      customer_id: booking.customer_id ?? null,
      customer_name: formatCustomerName(customer),
      customer_email: customer?.email ?? null,
      customer_phone: customer?.phone ?? null,
    };

    let items: Array<{
      id?: string | null;
      type?: string | null;
      title?: string | null;
      supplier_name?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      qty?: number | null;
      amount?: number | null;
      currency?: string | null;
      status?: string | null;
      meta?: unknown;
    }> = [];
    let payments: Array<{
      id?: string | null;
      booking_id?: string | null;
      amount?: number | null;
      currency?: string | null;
      status?: string | null;
      provider?: string | null;
      created_at?: string | null;
      raw?: unknown;
    }> = [];
    let documents: Array<{
      id?: string | null;
      booking_id?: string | null;
      type?: string | null;
      name?: string | null;
      url?: string | null;
      status?: string | null;
      created_at?: string | null;
    }> = [];
    let supplier_logs: Array<{
      id?: string | null;
      booking_id?: string | null;
      supplier?: string | null;
      action?: string | null;
      status?: string | null;
      message?: string | null;
      created_at?: string | null;
      payload?: unknown;
    }> = [];
    let timeline: Array<{
      id?: string | null;
      booking_id?: string | null;
      event?: string | null;
      status?: string | null;
      message?: string | null;
      created_at?: string | null;
    }> = [];

    if (bookingUuid) {
      const itemRows = await safeSelectMany<BookingItemRow>(
        db,
        "booking_items",
        new URLSearchParams({
          select:
            "id,booking_id,product_id,supplier_id,item_type,status,currency_code,quantity,total_amount,service_start_at,service_end_at,external_item_id,metadata,raw_provider_payload",
          booking_id: `eq.${bookingUuid}`,
          order: "created_at.asc",
        })
      );

      const productIds = Array.from(
        new Set(itemRows.map((row) => row.product_id).filter((value): value is string => Boolean(value)))
      );
      const supplierIds = Array.from(
        new Set(itemRows.map((row) => row.supplier_id).filter((value): value is string => Boolean(value)))
      );

      const [productRows, supplierRows] = await Promise.all([
        productIds.length
          ? safeSelectMany<ProductRow>(
              db,
              "products",
              new URLSearchParams({
                select: "id,name",
                id: `in.(${productIds.join(",")})`,
              })
            )
          : Promise.resolve([]),
        supplierIds.length
          ? safeSelectMany<SupplierRow>(
              db,
              "suppliers",
              new URLSearchParams({
                select: "id,legal_name,trade_name",
                id: `in.(${supplierIds.join(",")})`,
              })
            )
          : Promise.resolve([]),
      ]);

      const productMap = new Map(
        productRows
          .filter((row): row is ProductRow & { id: string } => Boolean(row.id))
          .map((row) => [row.id, safeString(row.name) || null])
      );
      const supplierMap = new Map(
        supplierRows
          .filter((row): row is SupplierRow & { id: string } => Boolean(row.id))
          .map((row) => [row.id, safeString(row.trade_name) || safeString(row.legal_name) || null])
      );

      items = itemRows.map((row) => {
        const meta = toJsonObject(row.metadata);
        const productTitle = safeString(productMap.get(row.product_id ?? "")) || null;
        const title = deriveItemTitle(
          meta,
          productTitle || safeString(row.external_item_id) || null
        );
        const segments = Array.isArray(meta?.segments) ? meta.segments : [];
        const firstSegment =
          segments[0] && typeof segments[0] === "object"
            ? (segments[0] as Record<string, unknown>)
            : null;
        const lastSegmentRaw = segments.length > 0 ? segments[segments.length - 1] : null;
        const lastSegment =
          lastSegmentRaw && typeof lastSegmentRaw === "object"
            ? (lastSegmentRaw as Record<string, unknown>)
            : null;
        const startDate =
          (row.service_start_at ?? safeString(firstSegment?.departure_at)) || null;
        const endDate =
          (row.service_end_at ?? safeString(lastSegment?.arrival_at)) || null;
        return {
          id: row.id ?? null,
          type: safeString(row.item_type) || null,
          title,
          supplier_name: deriveSupplierName(
            safeString(supplierMap.get(row.supplier_id ?? "")) || null,
            meta
          ),
          start_date: startDate,
          end_date: endDate,
          qty: toNumber(row.quantity),
          amount: toNumber(row.total_amount),
          currency: safeString(row.currency_code) || null,
          status: safeString(row.status) || null,
          meta: row.metadata ?? row.raw_provider_payload ?? null,
        };
      });

      const paymentRows = await safeSelectMany<PaymentRow>(
        db,
        "payments",
        new URLSearchParams({
          select: "id,booking_id,amount,currency_code,status,provider,created_at,raw_payload",
          booking_id: `eq.${bookingUuid}`,
          order: "created_at.desc",
          limit: "20",
        })
      );
      payments = paymentRows.map((row) => ({
        id: row.id ?? null,
        booking_id: row.booking_id ?? null,
        amount: toNumber(row.amount),
        currency: safeString(row.currency_code) || null,
        status: safeString(row.status) || null,
        provider: safeString(row.provider) || null,
        created_at: row.created_at ?? null,
        raw: row.raw_payload ?? null,
      }));

      const documentRows = await safeSelectMany<DocumentRow>(
        db,
        "documents",
        new URLSearchParams({
          select: "id,booking_id,type,status,url,file_url,public_url,storage_path,file_path,created_at,metadata",
          booking_id: `eq.${bookingUuid}`,
          order: "created_at.desc",
          limit: "20",
        })
      );
      documents = documentRows.map((row) => ({
        id: row.id ?? null,
        booking_id: row.booking_id ?? null,
        type: safeString(row.type) || null,
        name: deriveDocumentName(row),
        url: safeString(row.public_url) || safeString(row.url) || safeString(row.file_url) || null,
        status: safeString(row.status) || null,
        created_at: row.created_at ?? null,
      }));

      const supplierLogRows = await safeSelectMany<GenericRow>(
        db,
        "supplier_logs",
        new URLSearchParams({
          select: "*",
          booking_id: `eq.${bookingUuid}`,
          order: "created_at.desc",
          limit: "30",
        })
      );
      supplier_logs = supplierLogRows.map(normalizeSupplierLogRow);

      let timelineRows: GenericRow[] = [];
      const bookingEventsRows = await safeSelectMany<GenericRow>(
        db,
        "booking_events",
        new URLSearchParams({
          select: "*",
          booking_id: `eq.${bookingUuid}`,
          order: "created_at.asc",
          limit: "50",
        })
      );
      if (bookingEventsRows.length > 0) {
        timelineRows = bookingEventsRows;
      } else {
        const lifecycleRows = await safeSelectMany<GenericRow>(
          db,
          "booking_lifecycle_events",
          new URLSearchParams({
            select: "id,booking_id,event_name,to_status,note,created_at",
            booking_id: `eq.${bookingUuid}`,
            order: "created_at.asc",
            limit: "50",
          })
        );
        if (lifecycleRows.length > 0) {
          timelineRows = lifecycleRows;
        } else {
          const systemLogRows = await safeSelectMany<GenericRow>(
            db,
            "system_logs",
            new URLSearchParams({
              select: "*",
              booking_id: `eq.${bookingUuid}`,
              order: "created_at.asc",
              limit: "50",
            })
          );
          timelineRows = systemLogRows;
        }
      }

      timeline =
        timelineRows.length > 0
          ? normalizeTimelineRowsFromGeneric(timelineRows)
          : fallbackTimeline(bookingPayload.booking_id, booking);
    } else {
      timeline = fallbackTimeline(bookingPayload.booking_id, booking);
    }

    return NextResponse.json({
      booking: bookingPayload,
      items,
      payments,
      documents,
      supplier_logs,
      timeline,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({
        booking: null,
        items: [],
        payments: [],
        documents: [],
        supplier_logs: [],
        timeline: [],
      });
    }

    return routeError(500, "Failed to load booking details");
  }
}
