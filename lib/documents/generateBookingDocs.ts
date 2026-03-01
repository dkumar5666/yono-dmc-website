import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { BOOKING_DOC_TYPES, BookingDocDefinition, BookingDocKey } from "@/lib/documents/docTypes";
import { renderInvoiceHtml } from "@/lib/documents/templates/invoice";
import { renderVoucherHtml } from "@/lib/documents/templates/voucher";
import { recordAutomationFailure } from "@/lib/system/automationFailures";
import { recordRouteDuration } from "@/lib/system/opsTelemetry";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

interface BookingRow {
  id?: string | null;
  booking_code?: string | null;
  customer_id?: string | null;
  lifecycle_status?: string | null;
  supplier_status?: string | null;
  supplier_confirmation_reference?: string | null;
  payment_status?: string | null;
  gross_amount?: number | string | null;
  currency_code?: string | null;
  travel_start_date?: string | null;
  travel_end_date?: string | null;
  metadata?: unknown;
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
  item_type?: string | null;
  type?: string | null;
  title?: string | null;
  total_amount?: number | string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  currency?: string | null;
  service_start_at?: string | null;
  service_end_at?: string | null;
  metadata?: unknown;
}

interface ExistingDocumentRow {
  table: "documents" | "booking_documents";
  id?: string | null;
  type?: string | null;
  document_type?: string | null;
  status?: string | null;
  public_url?: string | null;
  url?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  metadata?: unknown;
}

export interface GenerateBookingDocsSummary {
  ok: boolean;
  generated: BookingDocKey[];
  skipped: BookingDocKey[];
  failed: Array<{ type: BookingDocKey; error: string }>;
}

const DOCUMENTS_BUCKET = process.env.DOCUMENTS_BUCKET?.trim() || "documents";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function isReadyDocument(row: ExistingDocumentRow | null): boolean {
  if (!row) return false;
  const status = safeString(row.status).toLowerCase();
  const url = safeString(row.public_url) || safeString(row.url) || safeString(row.file_url);
  if (!url) return false;
  if (!status) return true;
  return status !== "failed" && status !== "pending";
}

function supplierIsConfirmed(booking: BookingRow): boolean {
  const lifecycle = safeString(booking.lifecycle_status).toLowerCase();
  const supplierStatus = safeString(booking.supplier_status).toLowerCase();
  const supplierRef = safeString(booking.supplier_confirmation_reference);
  if (supplierRef) return true;
  if (supplierStatus.includes("confirm")) return true;
  return ["supplier_confirmed", "documents_generated", "completed"].includes(lifecycle);
}

function getBookingPathRef(booking: BookingRow, bookingRef: string): string {
  return safeString(booking.booking_code) || safeString(booking.id) || bookingRef;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCustomerName(customer: CustomerRow | null): string {
  if (!customer) return "Traveler";
  const fullName = [safeString(customer.first_name), safeString(customer.last_name)]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || "Traveler";
}

function getDestination(booking: BookingRow, items: BookingItemRow[]): string {
  const bookingMeta = isRecord(booking.metadata) ? booking.metadata : {};
  const fromBooking =
    safeString(bookingMeta.destination) ||
    safeString(bookingMeta.city) ||
    safeString(bookingMeta.destination_name);
  if (fromBooking) return fromBooking;
  for (const item of items) {
    const meta = isRecord(item.metadata) ? item.metadata : {};
    const fromItem = safeString(meta.destination) || safeString(meta.city);
    if (fromItem) return fromItem;
  }
  return "As per itinerary";
}

function getItemsForTemplate(items: BookingItemRow[], fallbackCurrency: string) {
  return items.map((item) => {
    const meta = isRecord(item.metadata) ? item.metadata : {};
    const title =
      safeString(item.title) ||
      safeString(meta.title) ||
      safeString(meta.name) ||
      "Booking item";
    const type = safeString(item.item_type) || safeString(item.type) || "service";
    return {
      title,
      type,
      amount: toNumber(item.total_amount ?? item.amount),
      currency: safeString(item.currency_code) || safeString(item.currency) || fallbackCurrency || "INR",
      start: safeString(item.service_start_at),
      end: safeString(item.service_end_at),
    };
  });
}

function renderItinerarySummaryHtml(input: {
  bookingCode: string;
  customerName: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  items: Array<{ title: string; type: string; start: string; end: string }>;
}): string {
  const rows = input.items
    .map(
      (item, index) => `
        <tr>
          <td style="padding:8px;border:1px solid #dbeafe;">${index + 1}</td>
          <td style="padding:8px;border:1px solid #dbeafe;">${item.type || "-"}</td>
          <td style="padding:8px;border:1px solid #dbeafe;">${item.title || "-"}</td>
          <td style="padding:8px;border:1px solid #dbeafe;">${item.start || "-"}</td>
          <td style="padding:8px;border:1px solid #dbeafe;">${item.end || "-"}</td>
        </tr>`
    )
    .join("");

  return `
    <html>
      <body style="font-family:Arial,sans-serif;color:#0f172a;padding:24px;">
        <h1 style="margin:0 0 8px 0;color:#0b3a82;">Yono DMC - Itinerary Summary</h1>
        <p style="margin:0 0 16px 0;color:#334155;">Booking: <strong>${input.bookingCode}</strong></p>
        <p style="margin:0 0 6px 0;"><strong>Traveler:</strong> ${input.customerName}</p>
        <p style="margin:0 0 6px 0;"><strong>Destination:</strong> ${input.destination}</p>
        <p style="margin:0 0 18px 0;"><strong>Travel Dates:</strong> ${input.travelStartDate} to ${input.travelEndDate}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#eff6ff;">
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">#</th>
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Type</th>
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Item</th>
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">Start</th>
              <th style="padding:8px;border:1px solid #dbeafe;text-align:left;">End</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="5" style="padding:10px;border:1px solid #dbeafe;">No itinerary items available</td></tr>`}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

async function safeSelectSingle<T>(db: SupabaseRestClient, table: string, query: URLSearchParams): Promise<T | null> {
  try {
    return await db.selectSingle<T>(table, query);
  } catch {
    return null;
  }
}

async function safeSelectMany<T>(db: SupabaseRestClient, table: string, query: URLSearchParams): Promise<T[]> {
  try {
    const rows = await db.selectMany<T>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function safeInsert(db: SupabaseRestClient, table: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await db.insertSingle(table, payload);
    return true;
  } catch {
    return false;
  }
}

async function safeUpdate(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams,
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.updateSingle(table, query, payload);
    return true;
  } catch {
    return false;
  }
}

async function resolveBooking(db: SupabaseRestClient, bookingRef: string): Promise<BookingRow | null> {
  const select =
    "id,booking_code,customer_id,lifecycle_status,supplier_status,supplier_confirmation_reference,payment_status,gross_amount,currency_code,travel_start_date,travel_end_date,metadata";

  const byCode = await safeSelectSingle<BookingRow>(
    db,
    "bookings",
    new URLSearchParams({
      select,
      booking_code: `eq.${bookingRef}`,
    })
  );
  if (byCode) return byCode;

  if (looksLikeUuid(bookingRef)) {
    return safeSelectSingle<BookingRow>(
      db,
      "bookings",
      new URLSearchParams({
        select,
        id: `eq.${bookingRef}`,
      })
    );
  }

  return null;
}

async function resolveCustomer(db: SupabaseRestClient, customerId: string | null): Promise<CustomerRow | null> {
  const id = safeString(customerId);
  if (!id) return null;
  return safeSelectSingle<CustomerRow>(
    db,
    "customers",
    new URLSearchParams({
      select: "id,first_name,last_name,email,phone",
      id: `eq.${id}`,
    })
  );
}

async function resolveItems(db: SupabaseRestClient, bookingId: string): Promise<BookingItemRow[]> {
  if (!bookingId) return [];
  return safeSelectMany<BookingItemRow>(
    db,
    "booking_items",
    new URLSearchParams({
      select:
        "id,item_type,type,title,total_amount,amount,currency_code,currency,service_start_at,service_end_at,metadata",
      booking_id: `eq.${bookingId}`,
      order: "created_at.asc",
      limit: "100",
    })
  );
}

async function hasItineraryRows(db: SupabaseRestClient, bookingId: string): Promise<boolean> {
  if (!bookingId) return false;
  const rows = await safeSelectMany<{ id?: string | null }>(
    db,
    "itineraries",
    new URLSearchParams({
      select: "id",
      booking_id: `eq.${bookingId}`,
      limit: "1",
    })
  );
  return rows.length > 0;
}

async function findExistingDocument(
  db: SupabaseRestClient,
  bookingId: string,
  bookingCode: string,
  docType: string
): Promise<ExistingDocumentRow | null> {
  const bookingRefs = [bookingId, bookingCode].filter(Boolean);

  for (const ref of bookingRefs) {
    const docsRow = await safeSelectSingle<ExistingDocumentRow>(
      db,
      "documents",
      new URLSearchParams({
        select: "id,type,status,public_url,url,storage_path,metadata",
        booking_id: `eq.${ref}`,
        type: `eq.${docType}`,
        order: "created_at.desc",
        limit: "1",
      })
    );
    if (docsRow) return { ...docsRow, table: "documents" };
  }

  for (const ref of bookingRefs) {
    const bookingDocsRow = await safeSelectSingle<ExistingDocumentRow>(
      db,
      "booking_documents",
      new URLSearchParams({
        select: "id,document_type,status,file_url,file_path,name",
        booking_id: `eq.${ref}`,
        document_type: `eq.${docType}`,
        order: "created_at.desc",
        limit: "1",
      })
    );
    if (bookingDocsRow) return { ...bookingDocsRow, table: "booking_documents" };
  }

  return null;
}

async function writeSystemNote(
  db: SupabaseRestClient,
  payload: Record<string, unknown>
): Promise<void> {
  const attempts: Array<Record<string, unknown>> = [
    payload,
    {
      level: payload.level,
      event: payload.event,
      message: payload.message,
      booking_id: payload.booking_id,
      meta: payload.meta,
    },
    {
      event: payload.event,
      message: payload.message,
      meta: payload.meta,
    },
    {
      message: payload.message,
      meta: payload.meta,
    },
  ];

  for (const candidate of attempts) {
    const ok = await safeInsert(db, "system_logs", candidate);
    if (ok) return;
  }
}

async function upsertDocumentRow(args: {
  db: SupabaseRestClient;
  existing: ExistingDocumentRow | null;
  booking: BookingRow;
  bookingPathRef: string;
  doc: BookingDocDefinition;
  publicUrl: string;
  storagePath: string;
  checksumValue: string;
  trigger: string;
  htmlPreview: string;
}): Promise<boolean> {
  const { db, existing, booking, bookingPathRef, doc, publicUrl, storagePath, checksumValue, trigger, htmlPreview } = args;
  const now = new Date().toISOString();
  const metadata = {
    trigger,
    generated_at: now,
    source: "generateDocsForBooking",
    preview_html: htmlPreview.slice(0, 1200),
  };

  if (existing?.id && existing.table === "documents") {
    const query = new URLSearchParams({ id: `eq.${existing.id}` });
    const updateAttempts: Array<Record<string, unknown>> = [
      {
        status: "ready",
        public_url: publicUrl,
        url: publicUrl,
        storage_bucket: DOCUMENTS_BUCKET,
        storage_path: storagePath,
        file_path: storagePath,
        mime_type: "application/pdf",
        checksum: checksumValue,
        generated_at: now,
        metadata,
      },
      {
        status: "uploaded",
        public_url: publicUrl,
        storage_path: storagePath,
        generated_at: now,
        metadata,
      },
      {
        status: "uploaded",
        url: publicUrl,
        file_path: storagePath,
        metadata,
      },
    ];

    for (const patch of updateAttempts) {
      const ok = await safeUpdate(db, "documents", query, patch);
      if (ok) return true;
    }
  }

  if (existing?.id && existing.table === "booking_documents") {
    const query = new URLSearchParams({ id: `eq.${existing.id}` });
    const updateAttempts: Array<Record<string, unknown>> = [
      {
        status: "ready",
        file_url: publicUrl,
        url: publicUrl,
        file_path: storagePath,
        updated_at: now,
      },
      {
        status: "uploaded",
        file_url: publicUrl,
        file_path: storagePath,
        updated_at: now,
      },
    ];

    for (const patch of updateAttempts) {
      const ok = await safeUpdate(db, "booking_documents", query, patch);
      if (ok) return true;
    }
  }

  const bookingId = safeString(booking.id);
  const customerId = safeString(booking.customer_id) || null;

  const documentInsertAttempts: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      booking_id: bookingId || bookingPathRef,
      customer_id: customerId,
      type: doc.dbType,
      status: "ready",
      version: 1,
      storage_bucket: DOCUMENTS_BUCKET,
      storage_path: storagePath,
      public_url: publicUrl,
      url: publicUrl,
      mime_type: "application/pdf",
      checksum: checksumValue,
      generated_at: now,
      metadata,
    },
    {
      id: randomUUID(),
      booking_id: bookingId || bookingPathRef,
      type: doc.dbType,
      status: "uploaded",
      public_url: publicUrl,
      storage_path: storagePath,
      metadata,
    },
    {
      booking_id: bookingId || bookingPathRef,
      type: doc.dbType,
      status: "uploaded",
      url: publicUrl,
      file_path: storagePath,
      metadata,
    },
  ];

  for (const payload of documentInsertAttempts) {
    const ok = await safeInsert(db, "documents", payload);
    if (ok) return true;
  }

  const bookingDocsAttempts: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      booking_id: bookingId || bookingPathRef,
      document_type: doc.dbType,
      file_name: `${doc.storageName}.pdf`,
      name: doc.label,
      file_url: publicUrl,
      url: publicUrl,
      file_path: storagePath,
      status: "ready",
      created_at: now,
      updated_at: now,
    },
    {
      booking_id: bookingId || bookingPathRef,
      document_type: doc.dbType,
      file_url: publicUrl,
      file_path: storagePath,
      status: "uploaded",
    },
  ];

  for (const payload of bookingDocsAttempts) {
    const ok = await safeInsert(db, "booking_documents", payload);
    if (ok) return true;
  }

  return false;
}

async function markDocumentFailed(args: {
  db: SupabaseRestClient;
  existing: ExistingDocumentRow | null;
  booking: BookingRow;
  bookingPathRef: string;
  doc: BookingDocDefinition;
  errorMessage: string;
  trigger: string;
}): Promise<void> {
  const { db, existing, booking, bookingPathRef, doc, errorMessage, trigger } = args;
  const now = new Date().toISOString();
  const metadata = {
    trigger,
    failed_at: now,
    error: errorMessage,
  };

  if (existing?.id && existing.table === "documents") {
    const updated = await safeUpdate(
      db,
      "documents",
      new URLSearchParams({ id: `eq.${existing.id}` }),
      { status: "failed", metadata }
    );
    if (updated) return;
  }

  if (existing?.id && existing.table === "booking_documents") {
    const updated = await safeUpdate(
      db,
      "booking_documents",
      new URLSearchParams({ id: `eq.${existing.id}` }),
      { status: "failed", updated_at: now }
    );
    if (updated) return;
  }

  const bookingId = safeString(booking.id) || bookingPathRef;
  const insertAttempts: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      booking_id: bookingId,
      type: doc.dbType,
      status: "failed",
      metadata,
    },
    {
      booking_id: bookingId,
      document_type: doc.dbType,
      status: "failed",
      updated_at: now,
    },
  ];

  for (const payload of insertAttempts) {
    const table = "type" in payload ? "documents" : "booking_documents";
    const ok = await safeInsert(db, table, payload);
    if (ok) return;
  }
}

function buildPseudoPdfContent(label: string, html: string): string {
  return `Yono DMC ${label}\nGenerated At: ${new Date().toISOString()}\n\n${html}`;
}

export async function generateDocsForBooking(
  booking_id: string,
  trigger: string
): Promise<GenerateBookingDocsSummary> {
  const startedAt = Date.now();
  const generated: BookingDocKey[] = [];
  const skipped: BookingDocKey[] = [];
  const failed: Array<{ type: BookingDocKey; error: string }> = [];
  let perfOutcome: "success" | "fail" | "warn" = "success";
  const finish = (summary: GenerateBookingDocsSummary): GenerateBookingDocsSummary => {
    perfOutcome = summary.ok ? "success" : summary.failed.length > 0 ? "fail" : "warn";
    return summary;
  };

  const bookingRef = safeString(booking_id);
  if (!bookingRef) {
    return finish({
      ok: false,
      generated,
      skipped,
      failed: [{ type: "invoice", error: "Missing booking_id" }],
    });
  }

  try {
    const db = new SupabaseRestClient();
    const booking = await resolveBooking(db, bookingRef);
    if (!booking || !safeString(booking.id)) {
      return finish({
        ok: false,
        generated,
        skipped,
        failed: [{ type: "invoice", error: "Booking not found" }],
      });
    }

    const bookingUuid = safeString(booking.id);
    const bookingPathRef = getBookingPathRef(booking, bookingRef);
    const customer = await resolveCustomer(db, safeString(booking.customer_id) || null);
    const items = await resolveItems(db, bookingUuid);
    const itineraryExists = (await hasItineraryRows(db, bookingUuid)) || items.length > 0;
    const supplierConfirmed = supplierIsConfirmed(booking);
    let supplierPendingLogged = false;

    const customerName = getCustomerName(customer);
    const destination = getDestination(booking, items);
    const currency = safeString(booking.currency_code) || "INR";
    const totalAmount = toNumber(booking.gross_amount);
    const itemTemplates = getItemsForTemplate(items, currency);

    for (const doc of BOOKING_DOC_TYPES) {
      if (doc.key === "itinerary_summary" && !itineraryExists) {
        skipped.push(doc.key);
        continue;
      }

      if (doc.requiresSupplierConfirmation && !supplierConfirmed) {
        skipped.push(doc.key);
        if (!supplierPendingLogged) {
          supplierPendingLogged = true;
          await writeSystemNote(db, {
            level: "info",
            event: "documents.pending_supplier_confirmation",
            booking_id: bookingUuid,
            message: "Document generation pending supplier confirmation",
            meta: {
              booking_id: bookingUuid,
              trigger,
            },
          });
        }
        continue;
      }

      const existing = await findExistingDocument(db, bookingUuid, bookingPathRef, doc.dbType);
      if (isReadyDocument(existing)) {
        skipped.push(doc.key);
        continue;
      }

      try {
        const generatedAt = new Date().toISOString();
        const bookingCode = safeString(booking.booking_code) || bookingUuid;
        const html =
          doc.key === "invoice"
            ? renderInvoiceHtml({
                bookingCode,
                customerName,
                customerEmail: safeString(customer?.email) || "Not available",
                customerPhone: safeString(customer?.phone) || "Not available",
                amount: totalAmount,
                currency,
                createdAt: formatDate(generatedAt),
                items: itemTemplates.map((item) => ({
                  title: item.title,
                  type: item.type,
                  amount: item.amount,
                  currency: item.currency,
                })),
              })
            : doc.key === "booking_confirmation"
              ? renderVoucherHtml({
                  bookingCode,
                  customerName,
                  destination,
                  travelStartDate: formatDate(booking.travel_start_date),
                  travelEndDate: formatDate(booking.travel_end_date),
                  supplierReference: safeString(booking.supplier_confirmation_reference) || "Pending",
                  generatedAt: formatDate(generatedAt),
                })
              : renderItinerarySummaryHtml({
                  bookingCode,
                  customerName,
                  destination,
                  travelStartDate: formatDate(booking.travel_start_date),
                  travelEndDate: formatDate(booking.travel_end_date),
                  items: itemTemplates.map((item) => ({
                    title: item.title,
                    type: item.type,
                    start: formatDate(item.start),
                    end: formatDate(item.end),
                  })),
                });

        const pseudoPdf = buildPseudoPdfContent(doc.label, html);
        const storagePath = `bookings/${bookingPathRef}/${doc.storageName}.pdf`;
        await db.uploadFile(DOCUMENTS_BUCKET, storagePath, pseudoPdf, "application/pdf");
        const publicUrl = db.publicUrl(DOCUMENTS_BUCKET, storagePath);
        const checksumValue = checksum(pseudoPdf);

        const persisted = await upsertDocumentRow({
          db,
          existing,
          booking,
          bookingPathRef,
          doc,
          publicUrl,
          storagePath,
          checksumValue,
          trigger,
          htmlPreview: html,
        });
        if (!persisted) {
          throw new Error("Document row update failed");
        }

        generated.push(doc.key);
      } catch (error) {
        const message =
          error instanceof Error && safeString(error.message)
            ? safeString(error.message)
            : "Document generation failed";
        failed.push({ type: doc.key, error: message });

        await markDocumentFailed({
          db,
          existing,
          booking,
          bookingPathRef,
          doc,
          errorMessage: message,
          trigger,
        });

        await recordAutomationFailure({
          bookingId: bookingUuid,
          event: "documents.generate",
          errorMessage: message,
          attempts: 0,
          payload: {
            booking_id: bookingUuid,
            doc_type: doc.key,
            trigger,
          },
          meta: {
            source: "generateDocsForBooking",
            doc_type: doc.key,
            trigger,
          },
        });
      }
    }

    return finish({
      ok: failed.length === 0,
      generated,
      skipped,
      failed,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return finish({
        ok: false,
        generated,
        skipped,
        failed: [{ type: "invoice", error: "Supabase not configured" }],
      });
    }
    const message = error instanceof Error ? error.message : "Document generation failed";
    return finish({
      ok: false,
      generated,
      skipped,
      failed: [{ type: "invoice", error: message }],
    });
  } finally {
    await recordRouteDuration({
      route: "/documents/generateDocsForBooking",
      durationMs: Date.now() - startedAt,
      statusCode: perfOutcome === "success" ? 200 : 500,
      outcome: perfOutcome,
    });
  }
}
