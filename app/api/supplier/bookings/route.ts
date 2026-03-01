import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import {
  listSupplierAssignments,
  resolveBookingByReference,
  resolveSupplierIdentityByUserId,
} from "@/lib/supplier/assignmentResolver";
import { routeError } from "@/lib/middleware/routeError";

type GenericRow = Record<string, unknown>;

interface SupplierBookingListRow {
  booking_id: string;
  booking_uuid: string | null;
  status: string | null;
  payment_status: string | null;
  supplier_status: string | null;
  created_at: string | null;
  start_at: string | null;
  end_at: string | null;
  due_at: string | null;
  service_type: string | null;
  service_types: string[];
  assignment_status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
}

interface SupplierInvoiceListRow {
  id: string | null;
  booking_id: string | null;
  booking_uuid: string | null;
  type: string | null;
  name: string | null;
  url: string | null;
  status: string | null;
  created_at: string | null;
}

interface CustomerRow {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? "50");
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.floor(parsed)));
}

function parseOffset(value: string | null): number {
  const parsed = Number(value ?? "0");
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function formatCustomerName(customer: CustomerRow | undefined): string | null {
  if (!customer) return null;
  const fullName = [safeString(customer.first_name), safeString(customer.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || safeString(customer.email) || null;
}

function normalizeStatus(value: string | null): string | null {
  const text = safeString(value).toLowerCase();
  return text || null;
}

function deriveAssignmentStatus(values: string[]): string | null {
  const statuses = values.map((value) => value.toLowerCase()).filter(Boolean);
  if (statuses.length === 0) return null;
  if (statuses.some((status) => status.includes("issue") || status.includes("fail"))) {
    return "issue_reported";
  }
  if (statuses.some((status) => status.includes("pending"))) {
    return "pending";
  }
  if (statuses.some((status) => status.includes("complete"))) {
    return "completed";
  }
  if (statuses.some((status) => status.includes("confirm"))) {
    return "confirmed";
  }
  return statuses[0] || null;
}

function deriveDueAt(candidates: Array<string | null | undefined>): string | null {
  let winner: Date | null = null;
  for (const candidate of candidates) {
    const date = safeDate(candidate ?? null);
    if (!date) continue;
    if (!winner || date.getTime() < winner.getTime()) {
      winner = date;
    }
  }
  return winner ? winner.toISOString() : null;
}

async function loadCustomerMap(
  db: SupabaseRestClient,
  customerIds: string[]
): Promise<Map<string, CustomerRow>> {
  const ids = Array.from(new Set(customerIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, CustomerRow>();

  const query = new URLSearchParams({
    select: "id,first_name,last_name,email,phone",
    id: `in.(${ids.join(",")})`,
    limit: String(Math.min(1000, ids.length)),
  });

  const rows = await safeSelectMany<CustomerRow>(db, "customers", query);
  const map = new Map<string, CustomerRow>();
  for (const row of rows) {
    const id = safeString(row.id);
    if (!id) continue;
    map.set(id, row);
  }
  return map;
}

async function resolveInvoiceRows(
  db: SupabaseRestClient,
  supplierId: string,
  bookingRows: SupplierBookingListRow[]
): Promise<SupplierInvoiceListRow[]> {
  const invoiceRows: SupplierInvoiceListRow[] = [];
  const dedupe = new Set<string>();

  for (const booking of bookingRows) {
    const bookingRefs = [safeString(booking.booking_uuid), safeString(booking.booking_id)].filter(Boolean);
    for (const ref of bookingRefs) {
      const rows = await safeSelectMany<GenericRow>(
        db,
        "documents",
        new URLSearchParams({
          select:
            "id,booking_id,supplier_id,type,name,url,public_url,file_url,status,created_at",
          booking_id: `eq.${ref}`,
          type: "eq.supplier_invoice",
          order: "created_at.desc",
          limit: "20",
        })
      );

      for (const row of rows) {
        const rowSupplierId = safeString(row.supplier_id);
        if (rowSupplierId && rowSupplierId !== supplierId) continue;

        const id = safeString(row.id) || `${safeString(row.booking_id)}:${safeString(row.created_at)}`;
        if (!id || dedupe.has(id)) continue;
        dedupe.add(id);

        invoiceRows.push({
          id: safeString(row.id) || null,
          booking_id: safeString(row.booking_id) || booking.booking_id,
          booking_uuid: safeString(booking.booking_uuid) || null,
          type: safeString(row.type) || null,
          name: safeString(row.name) || null,
          url: safeString(row.public_url) || safeString(row.url) || safeString(row.file_url) || null,
          status: safeString(row.status) || null,
          created_at: safeString(row.created_at) || null,
        });
      }
    }
  }

  invoiceRows.sort((a, b) => {
    const ta = safeDate(a.created_at)?.getTime() ?? 0;
    const tb = safeDate(b.created_at)?.getTime() ?? 0;
    return tb - ta;
  });

  return invoiceRows;
}

export async function GET(req: Request) {
  const auth = requireRole(req, "supplier");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  try {
    const db = new SupabaseRestClient();
    const supplierIdentity = await resolveSupplierIdentityByUserId(db, auth.userId);
    if (!supplierIdentity?.supplierId) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));
    const statusFilter = safeString(url.searchParams.get("status")).toLowerCase();
    const serviceTypeFilter = safeString(url.searchParams.get("service_type")).toLowerCase();
    const q = safeString(url.searchParams.get("q")).toLowerCase();
    const scope = safeString(url.searchParams.get("scope")).toLowerCase();
    const fromFilter = safeDate(url.searchParams.get("from"));
    const toFilter = safeDate(url.searchParams.get("to"));

    const assignments = await listSupplierAssignments(db, supplierIdentity.supplierId);
    if (assignments.length === 0) {
      return NextResponse.json({ rows: [], total: 0 });
    }

    const assignmentMap = new Map<
      string,
      {
        statuses: string[];
        serviceTypes: Set<string>;
        startDates: string[];
        endDates: string[];
      }
    >();

    for (const assignment of assignments) {
      const key = safeString(assignment.booking_id);
      if (!key) continue;
      const current =
        assignmentMap.get(key) ??
        {
          statuses: [],
          serviceTypes: new Set<string>(),
          startDates: [],
          endDates: [],
        };

      if (assignment.status) current.statuses.push(assignment.status);
      if (assignment.service_type) current.serviceTypes.add(assignment.service_type.toLowerCase());
      if (assignment.start_at) current.startDates.push(assignment.start_at);
      if (assignment.end_at) current.endDates.push(assignment.end_at);
      assignmentMap.set(key, current);
    }

    const bookingRefs = Array.from(assignmentMap.keys()).slice(0, 600);
    const resolvedBookings = await Promise.all(
      bookingRefs.map(async (ref) => {
        const booking = await resolveBookingByReference(db, ref);
        return { ref, booking };
      })
    );

    const customerIds = resolvedBookings
      .map((entry) => safeString(entry.booking?.customer_id))
      .filter(Boolean);
    const customerMap = await loadCustomerMap(db, customerIds);

    const rows: SupplierBookingListRow[] = resolvedBookings.map(({ ref, booking }) => {
      const bookingUuid = safeString(booking?.id) || null;
      const bookingId = safeString(booking?.booking_code) || bookingUuid || ref;
      const assignmentInfo =
        assignmentMap.get(bookingUuid || "") ??
        assignmentMap.get(bookingId) ??
        assignmentMap.get(ref) ?? {
          statuses: [],
          serviceTypes: new Set<string>(),
          startDates: [],
          endDates: [],
        };

      const serviceTypes = Array.from(assignmentInfo.serviceTypes).filter(Boolean);
      const customer = customerMap.get(safeString(booking?.customer_id));
      const dueAt = deriveDueAt([
        ...assignmentInfo.startDates,
        safeString(booking?.travel_start_date),
        safeString(booking?.created_at),
      ]);

      return {
        booking_id: bookingId,
        booking_uuid: bookingUuid,
        status: normalizeStatus(safeString(booking?.lifecycle_status) || null),
        payment_status: normalizeStatus(safeString(booking?.payment_status) || null),
        supplier_status: normalizeStatus(safeString(booking?.supplier_status) || null),
        created_at: safeString(booking?.created_at) || null,
        start_at: deriveDueAt(assignmentInfo.startDates),
        end_at: deriveDueAt(assignmentInfo.endDates),
        due_at: dueAt,
        service_type: serviceTypes[0] || null,
        service_types: serviceTypes,
        assignment_status: deriveAssignmentStatus(assignmentInfo.statuses),
        customer_name: formatCustomerName(customer),
        customer_email: safeString(customer?.email) || null,
        customer_phone: safeString(customer?.phone) || null,
      };
    });

    const filtered = rows.filter((row) => {
      if (statusFilter && statusFilter !== "all") {
        const statusTokens = [
          safeString(row.assignment_status).toLowerCase(),
          safeString(row.supplier_status).toLowerCase(),
          safeString(row.status).toLowerCase(),
        ].filter(Boolean);
        if (!statusTokens.some((token) => token.includes(statusFilter))) return false;
      }

      if (serviceTypeFilter && serviceTypeFilter !== "all") {
        const serviceTokens = [row.service_type, ...row.service_types]
          .map((value) => safeString(value).toLowerCase())
          .filter(Boolean);
        if (!serviceTokens.some((token) => token.includes(serviceTypeFilter))) return false;
      }

      const dueDate = safeDate(row.due_at || row.created_at);
      if (fromFilter && (!dueDate || dueDate.getTime() < fromFilter.getTime())) return false;
      if (toFilter && (!dueDate || dueDate.getTime() > toFilter.getTime())) return false;

      if (q) {
        const haystack = [
          row.booking_id,
          row.customer_name ?? "",
          row.customer_email ?? "",
          row.customer_phone ?? "",
          row.status ?? "",
          row.supplier_status ?? "",
          row.assignment_status ?? "",
          row.service_type ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const ta = safeDate(a.due_at || a.created_at)?.getTime() ?? 0;
      const tb = safeDate(b.due_at || b.created_at)?.getTime() ?? 0;
      return tb - ta;
    });

    if (scope === "invoices") {
      const invoiceRows = await resolveInvoiceRows(db, supplierIdentity.supplierId, filtered);
      const total = invoiceRows.length;
      const paged = invoiceRows.slice(offset, offset + limit);
      return NextResponse.json({ rows: paged, total });
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);
    return NextResponse.json({ rows: paged, total });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ rows: [], total: 0 });
    }
    return routeError(500, "Failed to load supplier bookings");
  }
}

