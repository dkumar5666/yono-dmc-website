import "server-only";

import { getPublicBaseUrl } from "@/lib/auth/baseUrl";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { generateDocsForBooking } from "@/lib/documents/generateBookingDocs";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

export interface OpsActor {
  userId: string | null;
  role: string | null;
  username: string | null;
}

export interface OpsActionResult<T = Record<string, unknown>> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
}

interface PaymentSyncInput {
  paymentId?: string | null;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
}

interface PaymentRow {
  id?: string | null;
  booking_id?: string | null;
  status?: string | null;
  provider?: string | null;
  provider_payment_id?: string | null;
  provider_order_id?: string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  updated_at?: string | null;
  raw_payload?: unknown;
}

interface RazorpayPaymentPayload {
  id?: string;
  status?: string;
  amount?: number;
  amount_captured?: number;
  amount_refunded?: number;
  order_id?: string;
  currency?: string;
}

interface RazorpayOrderPayload {
  id?: string;
  status?: string;
  amount?: number;
  amount_paid?: number;
  currency?: string;
}

interface CustomerLookupRow {
  id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  source: "customers" | "profiles" | "leads";
}

interface BookingLookupRow {
  booking_id: string | null;
  status: string | null;
  payment_status: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeLower(value: unknown): string {
  return safeString(value).toLowerCase();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseUsernameFromUserId(userId: string | null): string | null {
  const value = safeString(userId);
  if (!value) return null;
  if (value.startsWith("admin:")) return value.slice("admin:".length);
  return null;
}

function normalizeActor(actor: OpsActor): OpsActor {
  return {
    userId: safeString(actor.userId) || null,
    role: safeString(actor.role) || null,
    username: safeString(actor.username) || parseUsernameFromUserId(actor.userId) || null,
  };
}

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
  }
  return trimmed.replace(/[^\d]/g, "");
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePaymentStatus(value: string): string {
  const status = value.toLowerCase();
  if (status === "captured" || status === "paid") return "captured";
  if (status === "authorized") return "authorized";
  if (status === "failed") return "failed";
  if (status === "refunded") return "refunded";
  if (status === "created" || status === "attempted") return "created";
  return status || "created";
}

function mergeMeta(base: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const existing = isRecord(base) ? base : {};
  return { ...existing, ...patch };
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

async function safeSelectMany<T>(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams
): Promise<T[]> {
  try {
    const rows = await db.selectMany<T>(table, query);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function safeUpdate(
  db: SupabaseRestClient,
  table: string,
  query: URLSearchParams,
  patch: Record<string, unknown>
): Promise<boolean> {
  try {
    await db.updateSingle(table, query, patch);
    return true;
  } catch {
    return false;
  }
}

async function writeOpsAudit(
  db: SupabaseRestClient,
  actor: OpsActor,
  action: string,
  entityType: string,
  entityId: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const normalizedActor = normalizeActor(actor);
  await writeAdminAuditLog(db, {
    adminId: normalizedActor.userId,
    action,
    entityType,
    entityId,
    message,
    meta: {
      actor_role: normalizedActor.role ?? "admin",
      actor_user_id: normalizedActor.userId,
      actor_username: normalizedActor.username,
      ...(meta ?? {}),
    },
  });
}

async function markResolvedInTable(
  db: SupabaseRestClient,
  table: string,
  failureId: string
): Promise<boolean> {
  return safeUpdate(
    db,
    table,
    new URLSearchParams({
      id: `eq.${failureId}`,
    }),
    {
      status: "resolved",
      updated_at: new Date().toISOString(),
    }
  );
}

async function callInternalRoute(
  req: Request,
  path: string,
  payload?: Record<string, unknown>
): Promise<OpsActionResult<Record<string, unknown>>> {
  const key =
    safeString(process.env.INTERNAL_CRON_KEY) ||
    safeString(process.env.CRM_AUTOMATION_SECRET);
  if (!key) {
    return {
      ok: false,
      code: "internal_key_missing",
      message: "INTERNAL_CRON_KEY or CRM_AUTOMATION_SECRET is not configured.",
    };
  }

  const baseUrl = getPublicBaseUrl(req);
  const delimiter = path.includes("?") ? "&" : "?";
  const targetUrl = `${baseUrl}${path}${delimiter}key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "x-internal-key": key,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    let data: Record<string, unknown> = {};
    try {
      const json = (await response.json()) as unknown;
      if (isRecord(json)) data = json;
    } catch {
      // no-op
    }
    if (!response.ok) {
      return {
        ok: false,
        code: "internal_route_failed",
        message: `Internal route failed (${response.status}).`,
        data: {
          status: response.status,
          ...data,
        },
      };
    }
    return {
      ok: true,
      code: "ok",
      message: "Internal route executed successfully.",
      data,
    };
  } catch {
    return {
      ok: false,
      code: "internal_route_unreachable",
      message: "Failed to reach internal route.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callRazorpay<T extends object>(
  path: string
): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  const keyId = safeString(process.env.RAZORPAY_KEY_ID);
  const keySecret = safeString(process.env.RAZORPAY_KEY_SECRET);
  if (!keyId || !keySecret) {
    return {
      ok: false,
      code: "razorpay_config_missing",
      message: "Razorpay credentials are not configured.",
    };
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        code: "razorpay_request_failed",
        message: `Razorpay request failed (${response.status}).`,
      };
    }
    const json = (await response.json().catch(() => null)) as unknown;
    if (!isRecord(json)) {
      return {
        ok: false,
        code: "razorpay_invalid_response",
        message: "Razorpay response payload is invalid.",
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return {
      ok: false,
      code: "razorpay_unreachable",
      message: "Unable to reach Razorpay API.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePaymentForSync(
  db: SupabaseRestClient,
  input: PaymentSyncInput
): Promise<PaymentRow | null> {
  const paymentId = safeString(input.paymentId);
  const providerPaymentId = safeString(input.providerPaymentId);
  const providerOrderId = safeString(input.providerOrderId);
  const select =
    "id,booking_id,status,provider,provider_payment_id,provider_order_id,amount,currency_code,updated_at,raw_payload";

  if (paymentId) {
    const row = await safeSelectSingle<PaymentRow>(
      db,
      "payments",
      new URLSearchParams({
        select,
        id: `eq.${paymentId}`,
      })
    );
    if (row) return row;
  }

  if (providerPaymentId) {
    const row = await safeSelectSingle<PaymentRow>(
      db,
      "payments",
      new URLSearchParams({
        select,
        provider_payment_id: `eq.${providerPaymentId}`,
        order: "updated_at.desc",
        limit: "1",
      })
    );
    if (row) return row;
  }

  if (providerOrderId) {
    const row = await safeSelectSingle<PaymentRow>(
      db,
      "payments",
      new URLSearchParams({
        select,
        provider_order_id: `eq.${providerOrderId}`,
        order: "updated_at.desc",
        limit: "1",
      })
    );
    if (row) return row;
  }

  return null;
}

export async function runResendDocumentsAction(
  db: SupabaseRestClient,
  bookingId: string,
  actor: OpsActor
): Promise<OpsActionResult> {
  const bookingRef = safeString(bookingId);
  if (!bookingRef) {
    return { ok: false, code: "booking_id_missing", message: "booking_id is required." };
  }
  await writeOpsAudit(
    db,
    actor,
    "resend_documents",
    "booking",
    bookingRef,
    "Ops toolkit: resend documents requested"
  );
  return {
    ok: true,
    code: "resend_documents_recorded",
    message: "Resend documents request recorded.",
  };
}

export async function runRegenerateDocumentsAction(
  db: SupabaseRestClient,
  bookingId: string,
  actor: OpsActor
): Promise<OpsActionResult<Record<string, unknown>>> {
  const bookingRef = safeString(bookingId);
  if (!bookingRef) {
    return { ok: false, code: "booking_id_missing", message: "booking_id is required." };
  }
  const summary = await generateDocsForBooking(bookingRef, "admin.ops.regenerate_documents");
  await writeOpsAudit(
    db,
    actor,
    "generate_documents",
    "booking",
    bookingRef,
    "Ops toolkit: documents regeneration triggered",
    {
      generated_count: summary.generated.length,
      skipped_count: summary.skipped.length,
      failed_count: summary.failed.length,
    }
  );
  return {
    ok: summary.ok,
    code: summary.ok ? "documents_generated" : "documents_generated_with_failures",
    message: summary.ok
      ? "Documents regenerated successfully."
      : "Documents regeneration finished with failures.",
    data: {
      generated: summary.generated,
      skipped: summary.skipped,
      failed: summary.failed,
    },
  };
}

export async function runResyncSupplierAction(
  db: SupabaseRestClient,
  bookingId: string,
  actor: OpsActor
): Promise<OpsActionResult> {
  const bookingRef = safeString(bookingId);
  if (!bookingRef) {
    return { ok: false, code: "booking_id_missing", message: "booking_id is required." };
  }
  await writeOpsAudit(
    db,
    actor,
    "resync_supplier",
    "booking",
    bookingRef,
    "Ops toolkit: supplier resync requested"
  );
  return {
    ok: true,
    code: "resync_supplier_recorded",
    message: "Supplier resync request recorded.",
  };
}

export async function runResolveFailureAction(
  db: SupabaseRestClient,
  failureId: string,
  actor: OpsActor
): Promise<OpsActionResult> {
  const id = safeString(failureId);
  if (!id) {
    return { ok: false, code: "failure_id_missing", message: "failure_id is required." };
  }

  const marked =
    (await markResolvedInTable(db, "automation_failures", id)) ||
    (await markResolvedInTable(db, "event_failures", id));
  if (!marked) {
    return { ok: false, code: "failure_not_found", message: "Automation failure not found." };
  }

  await writeOpsAudit(
    db,
    actor,
    "mark_failure_resolved",
    "automation_failure",
    id,
    "Ops toolkit: automation failure marked resolved"
  );
  return {
    ok: true,
    code: "failure_resolved",
    message: "Automation failure marked as resolved.",
  };
}

export async function runCronRetryAction(
  req: Request,
  db: SupabaseRestClient,
  actor: OpsActor
): Promise<OpsActionResult<Record<string, unknown>>> {
  const result = await callInternalRoute(req, "/api/internal/automation/retry");
  await writeOpsAudit(
    db,
    actor,
    "ops_run_cron_retry",
    "system",
    "automation_retry",
    "Ops toolkit: cron retry triggered manually",
    {
      outcome_code: result.code,
      ok: result.ok,
    }
  );
  return result;
}

export async function runOutreachAction(
  req: Request,
  db: SupabaseRestClient,
  actor: OpsActor
): Promise<OpsActionResult<Record<string, unknown>>> {
  const result = await callInternalRoute(req, "/api/internal/crm/outreach/run");
  await writeOpsAudit(
    db,
    actor,
    "ops_run_outreach",
    "system",
    "crm_outreach",
    "Ops toolkit: outreach scheduler triggered manually",
    {
      outcome_code: result.code,
      ok: result.ok,
    }
  );
  return result;
}

export async function runSmokeTestsAction(
  req: Request,
  db: SupabaseRestClient,
  actor: OpsActor
): Promise<OpsActionResult<Record<string, unknown>>> {
  const baseUrl = getPublicBaseUrl(req);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}/api/admin/system/smoke-tests`, {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") ?? "",
        authorization: req.headers.get("authorization") ?? "",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as unknown;
    const data = isRecord(payload) ? payload : {};
    if (!response.ok) {
      const failedResult: OpsActionResult<Record<string, unknown>> = {
        ok: false,
        code: "smoke_tests_failed",
        message: `Smoke tests failed (${response.status}).`,
        data,
      };
      await writeOpsAudit(
        db,
        actor,
        "ops_run_smoke_tests",
        "system",
        "smoke_tests",
        "Ops toolkit: smoke tests executed with failures",
        { ok: false }
      );
      return failedResult;
    }
    const successResult: OpsActionResult<Record<string, unknown>> = {
      ok: true,
      code: "smoke_tests_ok",
      message: "Smoke tests executed.",
      data,
    };
    await writeOpsAudit(
      db,
      actor,
      "ops_run_smoke_tests",
      "system",
      "smoke_tests",
      "Ops toolkit: smoke tests executed",
      { ok: true }
    );
    return successResult;
  } catch {
    const failedResult: OpsActionResult = {
      ok: false,
      code: "smoke_tests_unreachable",
      message: "Unable to run smoke tests.",
    };
    await writeOpsAudit(
      db,
      actor,
      "ops_run_smoke_tests",
      "system",
      "smoke_tests",
      "Ops toolkit: smoke tests execution failed",
      { ok: false }
    );
    return failedResult;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runPaymentSyncAction(
  db: SupabaseRestClient,
  input: PaymentSyncInput,
  actor: OpsActor
): Promise<OpsActionResult<Record<string, unknown>>> {
  const payment = await resolvePaymentForSync(db, input);
  if (!payment || !safeString(payment.id)) {
    return { ok: false, code: "payment_not_found", message: "Payment not found." };
  }

  const provider = safeLower(payment.provider);
  if (provider && provider !== "razorpay") {
    return {
      ok: false,
      code: "provider_not_supported",
      message: `Payment provider '${provider}' is not supported by payment sync.`,
    };
  }

  const paymentId = safeString(payment.id);
  const providerPaymentId = safeString(input.providerPaymentId) || safeString(payment.provider_payment_id);
  const providerOrderId = safeString(input.providerOrderId) || safeString(payment.provider_order_id);
  const previousStatus = normalizePaymentStatus(safeString(payment.status));

  let remoteStatus = "";
  let remotePaymentId = providerPaymentId;
  let remoteOrderId = providerOrderId;
  let remoteAmountCaptured: number | null = null;
  let remoteAmountRefunded: number | null = null;
  let remoteCurrency = safeString(payment.currency_code) || "INR";
  let syncSource = "";

  if (providerPaymentId) {
    const paymentRes = await callRazorpay<RazorpayPaymentPayload>(`payments/${encodeURIComponent(providerPaymentId)}`);
    if (!paymentRes.ok) return paymentRes;
    remoteStatus = safeString(paymentRes.data.status);
    remotePaymentId = safeString(paymentRes.data.id) || remotePaymentId;
    remoteOrderId = safeString(paymentRes.data.order_id) || remoteOrderId;
    remoteAmountCaptured = toNumber(paymentRes.data.amount_captured);
    remoteAmountRefunded = toNumber(paymentRes.data.amount_refunded);
    remoteCurrency = safeString(paymentRes.data.currency) || remoteCurrency;
    syncSource = "razorpay_payment";
  } else if (providerOrderId) {
    const orderRes = await callRazorpay<RazorpayOrderPayload>(`orders/${encodeURIComponent(providerOrderId)}`);
    if (!orderRes.ok) return orderRes;
    remoteStatus = safeString(orderRes.data.status);
    remoteOrderId = safeString(orderRes.data.id) || remoteOrderId;
    remoteAmountCaptured = toNumber(orderRes.data.amount_paid);
    remoteCurrency = safeString(orderRes.data.currency) || remoteCurrency;
    syncSource = "razorpay_order";
  } else {
    return {
      ok: false,
      code: "provider_reference_missing",
      message: "No provider_payment_id or provider_order_id available for sync.",
    };
  }

  const mappedStatus = normalizePaymentStatus(remoteStatus);
  const patch = {
    status: mappedStatus || previousStatus,
    provider_payment_id: remotePaymentId || null,
    provider_order_id: remoteOrderId || null,
    amount_captured:
      remoteAmountCaptured !== null && Number.isFinite(remoteAmountCaptured)
        ? Math.round(remoteAmountCaptured / 100)
        : undefined,
    amount_refunded:
      remoteAmountRefunded !== null && Number.isFinite(remoteAmountRefunded)
        ? Math.round(remoteAmountRefunded / 100)
        : undefined,
    currency_code: remoteCurrency || undefined,
    updated_at: new Date().toISOString(),
    raw_payload: mergeMeta(payment.raw_payload, {
      ops_payment_sync: {
        at: new Date().toISOString(),
        source: syncSource,
        remote_status: remoteStatus || null,
        previous_status: previousStatus,
      },
    }),
  };

  await safeUpdate(
    db,
    "payments",
    new URLSearchParams({ id: `eq.${paymentId}` }),
    patch
  );

  const bookingId = safeString(payment.booking_id);
  if (bookingId && (mappedStatus === "captured" || mappedStatus === "paid")) {
    await safeUpdate(
      db,
      "bookings",
      new URLSearchParams({ id: `eq.${bookingId}` }),
      { payment_status: "paid", updated_at: new Date().toISOString() }
    );
    await safeUpdate(
      db,
      "bookings",
      new URLSearchParams({ booking_code: `eq.${bookingId}` }),
      { payment_status: "paid", updated_at: new Date().toISOString() }
    );
  }

  await writeOpsAudit(
    db,
    actor,
    "ops_payment_sync",
    "payment",
    paymentId,
    "Ops toolkit: payment sync executed",
    {
      previous_status: previousStatus,
      synced_status: mappedStatus || previousStatus,
      provider_payment_id: remotePaymentId || null,
      provider_order_id: remoteOrderId || null,
      booking_id: bookingId || null,
    }
  );

  return {
    ok: true,
    code: "payment_synced",
    message: "Payment sync completed.",
    data: {
      payment_id: paymentId,
      previous_status: previousStatus,
      synced_status: mappedStatus || previousStatus,
      provider_payment_id: remotePaymentId || null,
      provider_order_id: remoteOrderId || null,
      booking_id: bookingId || null,
    },
  };
}

function mapCustomerRow(source: CustomerLookupRow["source"], row: Record<string, unknown>): CustomerLookupRow {
  const fullName =
    safeString(row.full_name) ||
    [safeString(row.first_name), safeString(row.last_name)].filter(Boolean).join(" ").trim() ||
    safeString(row.customer_name) ||
    null;
  return {
    id: safeString(row.id) || null,
    full_name: fullName || null,
    email: safeString(row.email) || safeString(row.customer_email) || null,
    phone: safeString(row.phone) || safeString(row.customer_phone) || null,
    source,
  };
}

function mapBookingRow(row: Record<string, unknown>): BookingLookupRow {
  return {
    booking_id: safeString(row.booking_code) || safeString(row.id) || null,
    status: safeString(row.lifecycle_status) || safeString(row.status) || null,
    payment_status: safeString(row.payment_status) || null,
    amount: toNumber(row.gross_amount) ?? toNumber(row.total_amount) ?? null,
    currency: safeString(row.currency_code) || safeString(row.currency) || null,
    created_at: safeString(row.created_at) || null,
  };
}

export async function runCustomerLookup(
  db: SupabaseRestClient,
  queryValue: string,
  actor: OpsActor,
  limit = 20
): Promise<OpsActionResult<Record<string, unknown>>> {
  const raw = safeString(queryValue);
  if (!raw) {
    return { ok: false, code: "query_missing", message: "query is required." };
  }

  const emailQuery = looksLikeEmail(raw) ? raw.toLowerCase() : "";
  const phoneQuery = normalizePhone(raw);
  const textQuery = raw.toLowerCase();

  const customers: CustomerLookupRow[] = [];
  const seenCustomer = new Set<string>();
  const addCustomer = (entry: CustomerLookupRow) => {
    const key = `${entry.source}:${entry.id || entry.email || entry.phone || ""}`;
    if (!key || seenCustomer.has(key)) return;
    seenCustomer.add(key);
    customers.push(entry);
  };

  const customersRows = await safeSelectMany<Record<string, unknown>>(
    db,
    "customers",
    new URLSearchParams({
      select: "id,first_name,last_name,email,phone,created_at",
      order: "created_at.desc",
      limit: "300",
    })
  );
  for (const row of customersRows) {
    const entry = mapCustomerRow("customers", row);
    const email = safeLower(entry.email);
    const phone = normalizePhone(entry.phone || "");
    const name = safeLower(entry.full_name);
    const matches =
      (emailQuery && email.includes(emailQuery)) ||
      (phoneQuery && phone.includes(phoneQuery)) ||
      name.includes(textQuery);
    if (matches) addCustomer(entry);
  }

  const profileRows = await safeSelectMany<Record<string, unknown>>(
    db,
    "profiles",
    new URLSearchParams({
      select: "id,full_name,email,phone,role,created_at",
      order: "created_at.desc",
      limit: "300",
    })
  );
  for (const row of profileRows) {
    const role = safeLower(row.role);
    if (role && role !== "customer" && role !== "agent") continue;
    const entry = mapCustomerRow("profiles", row);
    const email = safeLower(entry.email);
    const phone = normalizePhone(entry.phone || "");
    const name = safeLower(entry.full_name);
    const matches =
      (emailQuery && email.includes(emailQuery)) ||
      (phoneQuery && phone.includes(phoneQuery)) ||
      name.includes(textQuery);
    if (matches) addCustomer(entry);
  }

  const leadRows = await safeSelectMany<Record<string, unknown>>(
    db,
    "leads",
    new URLSearchParams({
      select: "id,customer_name,customer_email,customer_phone,created_at",
      order: "created_at.desc",
      limit: "300",
    })
  );
  for (const row of leadRows) {
    const entry = mapCustomerRow("leads", row);
    const email = safeLower(entry.email);
    const phone = normalizePhone(entry.phone || "");
    const name = safeLower(entry.full_name);
    const matches =
      (emailQuery && email.includes(emailQuery)) ||
      (phoneQuery && phone.includes(phoneQuery)) ||
      name.includes(textQuery);
    if (matches) addCustomer(entry);
  }

  const customerIds = new Set(customers.map((row) => safeString(row.id)).filter(Boolean));
  const customerEmails = new Set(customers.map((row) => safeLower(row.email)).filter(Boolean));
  const customerPhones = new Set(customers.map((row) => normalizePhone(row.phone || "")).filter(Boolean));

  const bookingRows = await safeSelectMany<Record<string, unknown>>(
    db,
    "bookings",
    new URLSearchParams({
      select:
        "id,booking_code,customer_id,payment_status,lifecycle_status,status,gross_amount,total_amount,currency_code,currency,created_at,customer_email,customer_phone",
      order: "created_at.desc",
      limit: "500",
    })
  );
  const bookings = bookingRows
    .filter((row) => {
      const customerId = safeString(row.customer_id);
      const email = safeLower(row.customer_email);
      const phone = normalizePhone(safeString(row.customer_phone));
      return (
        (customerId && customerIds.has(customerId)) ||
        (email && customerEmails.has(email)) ||
        (phone && customerPhones.has(phone))
      );
    })
    .slice(0, Math.min(50, Math.max(1, Math.floor(limit))))
    .map(mapBookingRow);

  await writeOpsAudit(
    db,
    actor,
    "ops_customer_lookup",
    "customer_lookup",
    raw,
    "Ops toolkit: customer lookup executed",
    {
      query: raw,
      customer_matches: customers.length,
      booking_matches: bookings.length,
    }
  );

  return {
    ok: true,
    code: "customer_lookup_ok",
    message: "Customer lookup completed.",
    data: {
      query: raw,
      customers: customers.slice(0, 25),
      bookings,
    },
  };
}

export function createOpsDb(): SupabaseRestClient | null {
  try {
    return new SupabaseRestClient();
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return null;
    }
    return null;
  }
}
