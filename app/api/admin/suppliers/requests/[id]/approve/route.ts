import { apiError, apiSuccess } from "@/lib/backend/http";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import { getPublicBaseUrl } from "@/lib/auth/baseUrl";
import { getSupabaseConfig, SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  getSupplierSignupRequestById,
  logSupplierSignupSystemEvent,
  safeInsert,
  safeSelectMany,
  safeUpdate,
  updateSupplierSignupRequest,
  type SupplierSignupRequestRow,
} from "@/lib/supplierSignup/store";

type Params = { id: string };

type GenericRow = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function maskPhone(value: string): string {
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function mapBusinessTypeToSupplierType(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("airline")) return "airline";
  if (normalized.includes("hotel") || normalized.includes("villa") || normalized.includes("apartment")) return "hotel";
  if (normalized.includes("visa")) return "visa";
  if (normalized.includes("transport") || normalized.includes("bus") || normalized.includes("cab")) return "transport";
  if (normalized.includes("train")) return "transport";
  if (normalized.includes("insurance")) return "insurance";
  if (normalized.includes("activities") || normalized.includes("attractions")) return "activity";
  return "other";
}

function parseAuthUserId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const row = payload as Record<string, unknown>;
  const direct = safeString(row.id);
  if (direct) return direct;
  const user =
    row.user && typeof row.user === "object" && !Array.isArray(row.user)
      ? (row.user as Record<string, unknown>)
      : null;
  return safeString(user?.id);
}

async function authAdminPost(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown }> {
  const config = getSupabaseConfig();
  if (!config) {
    return { ok: false };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1${path}`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) return { ok: false };
    const data = await response.json().catch(() => null);
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

async function resolveUserIdByEmail(db: SupabaseRestClient, email: string): Promise<string> {
  const cleanEmail = safeString(email).toLowerCase();
  if (!cleanEmail) return "";
  const rows = await safeSelectMany<GenericRow>(
    db,
    "profiles",
    new URLSearchParams({
      select: "id,email",
      email: `eq.${cleanEmail}`,
      limit: "1",
    })
  );
  return safeString(rows[0]?.id);
}

async function createOrResolveSupplierUser(params: {
  db: SupabaseRestClient;
  req: Request;
  email: string;
  contactName: string;
  companyName: string;
  city: string;
  phone: string;
}): Promise<{ userId: string; recoveryLink: string | null; inviteEmailSent: boolean }> {
  let userId = "";
  const createUserResponse = await authAdminPost("/admin/users", {
    email: params.email,
    phone: params.phone || undefined,
    email_confirm: true,
    user_metadata: {
      full_name: params.contactName || params.companyName || "Supplier Partner",
      company_name: params.companyName || null,
      city: params.city || null,
    },
    app_metadata: {
      role: "supplier",
    },
  });

  if (createUserResponse.ok) {
    userId = parseAuthUserId(createUserResponse.data);
  }
  if (!userId) {
    userId = await resolveUserIdByEmail(params.db, params.email);
  }
  if (!userId) {
    throw new Error("supplier_auth_user_create_failed");
  }

  await ensureIdentityProfile({
    userId,
    role: "supplier",
    trustedRoleAssignment: true,
    fullName: params.contactName || undefined,
    email: params.email,
    phone: params.phone || undefined,
    companyName: params.companyName || undefined,
    city: params.city || undefined,
  });

  const baseUrl = getPublicBaseUrl(params.req);
  const recoveryResponse = await authAdminPost("/admin/generate_link", {
    type: "recovery",
    email: params.email,
    options: {
      redirect_to: `${baseUrl}/supplier/login`,
    },
  });

  if (!recoveryResponse.ok) {
    return { userId, recoveryLink: null, inviteEmailSent: false };
  }
  const recoveryLink =
    recoveryResponse.data &&
    typeof recoveryResponse.data === "object" &&
    !Array.isArray(recoveryResponse.data)
      ? safeString((recoveryResponse.data as Record<string, unknown>).action_link)
      : "";

  const inviteResponse = await authAdminPost("/invite", {
    email: params.email,
    data: {
      role: "supplier",
      company_name: params.companyName || null,
      full_name: params.contactName || null,
    },
    redirect_to: `${baseUrl}/supplier/login`,
  });

  return { userId, recoveryLink: recoveryLink || null, inviteEmailSent: inviteResponse.ok };
}

async function sendSupplierApprovalNotifications(params: {
  db: SupabaseRestClient;
  requestId: string;
  phone: string;
  contactName: string;
  companyName: string;
  recoveryLink: string | null;
  loginUrl: string;
}): Promise<{ whatsappSent: boolean; whatsappSkipped: boolean }> {
  const phone = safeString(params.phone);
  if (!phone) {
    return { whatsappSent: false, whatsappSkipped: true };
  }

  const apiKey = safeString(process.env.AISENSY_API_KEY);
  const baseUrl = safeString(process.env.AISENSY_BASE_URL) || "https://backend.aisensy.com";
  const senderId = safeString(process.env.AISENSY_SENDER_ID);
  if (!apiKey) {
    await logSupplierSignupSystemEvent(params.db, {
      requestId: params.requestId,
      event: "supplier_signup_approval_whatsapp_skipped",
      message: "Supplier approval WhatsApp skipped: missing AISENSY_API_KEY.",
      meta: { skipped: true, reason: "missing_config" },
    });
    return { whatsappSent: false, whatsappSkipped: true };
  }

  const payload: Record<string, unknown> = {
    destination: phone,
    templateName: "supplier_account_approved",
    campaignName: "supplier_account_approved",
    params: {
      name: params.contactName || params.companyName || "Partner",
      login_url: params.loginUrl,
      setup_url: params.recoveryLink || params.loginUrl,
    },
    userName: params.contactName || params.companyName || maskPhone(phone),
  };
  if (senderId) {
    payload.sender = senderId;
    payload.senderId = senderId;
  }

  let ok = false;
  let status = 0;
  let error = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/campaign/t1/api/v2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    status = response.status;
    ok = response.ok;
    if (!response.ok) {
      error = "request_failed";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "request_failed";
  }

  await logSupplierSignupSystemEvent(params.db, {
    requestId: params.requestId,
    event: ok
      ? "supplier_signup_approval_whatsapp_sent"
      : "supplier_signup_approval_whatsapp_failed",
    message: ok
      ? "Supplier approval WhatsApp sent."
      : "Supplier approval WhatsApp failed.",
    meta: {
      provider: "aisensy_direct",
      skipped: false,
      status: status || null,
      error: error || null,
    },
  });

  return {
    whatsappSent: ok,
    whatsappSkipped: false,
  };
}

async function findExistingSupplier(
  db: SupabaseRestClient,
  params: { userId: string; email: string; phone: string }
): Promise<GenericRow | null> {
  if (params.userId) {
    const byUser = await safeSelectMany<GenericRow>(
      db,
      "suppliers",
      new URLSearchParams({
        select: "*",
        user_id: `eq.${params.userId}`,
        limit: "1",
      })
    );
    if (byUser[0]) return byUser[0];
  }

  if (params.email) {
    const byEmail = await safeSelectMany<GenericRow>(
      db,
      "suppliers",
      new URLSearchParams({
        select: "*",
        contact_email: `eq.${params.email}`,
        limit: "1",
      })
    );
    if (byEmail[0]) return byEmail[0];
  }

  if (params.phone) {
    const byPhone = await safeSelectMany<GenericRow>(
      db,
      "suppliers",
      new URLSearchParams({
        select: "*",
        contact_phone: `eq.${params.phone}`,
        limit: "1",
      })
    );
    if (byPhone[0]) return byPhone[0];
  }

  return null;
}

async function ensureSupplierRecord(
  db: SupabaseRestClient,
  signupRequest: SupplierSignupRequestRow,
  userId: string
): Promise<string | null> {
  const email = safeString(signupRequest.contact_email).toLowerCase();
  const phone = safeString(signupRequest.contact_phone);
  const existing = await findExistingSupplier(db, { userId, email, phone });
  if (existing) {
    const existingId = safeString(existing.id);
    if (existingId) {
      if (userId) {
        await safeUpdate(
          db,
          "suppliers",
          new URLSearchParams({ id: `eq.${existingId}` }),
          { user_id: userId }
        );
      }
      return existingId;
    }
  }

  const supplierCode = `SUP-${Date.now()}`;
  const supplierType = mapBusinessTypeToSupplierType(safeString(signupRequest.business_type));
  const metadata = {
    from_signup_request_id: safeString(signupRequest.id),
    gstin: safeString(signupRequest.gstin) || null,
    pan: safeString(signupRequest.pan) || null,
    cin: safeString(signupRequest.cin) || null,
    iata_code: safeString(signupRequest.iata_code) || null,
    license_no: safeString(signupRequest.license_no) || null,
    bank_meta:
      signupRequest.bank_meta && typeof signupRequest.bank_meta === "object"
        ? signupRequest.bank_meta
        : {},
  };

  const payloads: Array<Record<string, unknown>> = [
    {
      id: userId,
      user_id: userId,
      supplier_code: supplierCode,
      supplier_type: supplierType,
      legal_name: safeString(signupRequest.company_legal_name) || "Supplier",
      trade_name: safeString(signupRequest.brand_name) || null,
      contact_email: email || null,
      contact_phone: phone || null,
      default_currency: "INR",
      api_enabled: false,
      status: "active",
      metadata,
    },
    {
      id: userId,
      supplier_code: supplierCode,
      supplier_type: supplierType,
      legal_name: safeString(signupRequest.company_legal_name) || "Supplier",
      trade_name: safeString(signupRequest.brand_name) || null,
      contact_email: email || null,
      contact_phone: phone || null,
      default_currency: "INR",
      api_enabled: false,
      status: "active",
      metadata,
    },
    {
      supplier_code: supplierCode,
      supplier_type: supplierType,
      legal_name: safeString(signupRequest.company_legal_name) || "Supplier",
      trade_name: safeString(signupRequest.brand_name) || null,
      contact_email: email || null,
      contact_phone: phone || null,
      default_currency: "INR",
      api_enabled: false,
      status: "active",
      metadata,
    },
  ];

  for (const payload of payloads) {
    const inserted = await safeInsert<GenericRow>(db, "suppliers", payload);
    const insertedId = safeString(inserted?.id);
    if (inserted && insertedId) return insertedId;
  }

  return null;
}

export async function POST(req: Request, ctx: { params: Promise<Params> | Params }) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const resolved = "then" in ctx.params ? await ctx.params : ctx.params;
    const requestId = decodeURIComponent(resolved.id ?? "").trim();
    if (!requestId) {
      return apiError(req, 400, "invalid_request_id", "Invalid request id.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, requestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }
    if (safeString(signupRequest.status) === "approved") {
      return apiSuccess(req, {
        request_id: requestId,
        status: "approved",
        alreadyApproved: true,
      });
    }

    if (!signupRequest.email_verified || !signupRequest.phone_verified) {
      return apiError(
        req,
        400,
        "request_not_verified",
        "Email and phone must be verified before approval."
      );
    }

    const email = safeString(signupRequest.contact_email).toLowerCase();
    const phone = safeString(signupRequest.contact_phone);
    const contactName = safeString(signupRequest.contact_name);
    const companyName = safeString(signupRequest.company_legal_name);
    const city = safeString(signupRequest.city);
    if (!email) {
      return apiError(req, 400, "email_missing", "Primary contact email is required.");
    }

    const { userId, recoveryLink, inviteEmailSent } = await createOrResolveSupplierUser({
      db,
      req,
      email,
      phone,
      contactName,
      companyName,
      city,
    });
    const supplierId = await ensureSupplierRecord(db, signupRequest, userId);
    const manualSupplierSetupRequired = !supplierId;
    const baseUrl = getPublicBaseUrl(req);
    const loginUrl = `${baseUrl}/supplier/login`;
    const whatsapp = await sendSupplierApprovalNotifications({
      db,
      requestId,
      phone,
      contactName,
      companyName,
      recoveryLink,
      loginUrl,
    });

    const existingMeta = safeObject(signupRequest.meta);
    const nextMeta = {
      ...existingMeta,
      supplier_id: supplierId || null,
      supplier_user_id: userId,
      approved_at: new Date().toISOString(),
      approved_by: auth.userId,
      recovery_link_sent: Boolean(recoveryLink),
      invite_email_sent: inviteEmailSent,
      whatsapp_sent: whatsapp.whatsappSent,
      supplier_login_url: loginUrl,
      manual_supplier_setup_required: manualSupplierSetupRequired,
    };

    await updateSupplierSignupRequest(db, requestId, {
      status: "approved",
      meta: nextMeta,
    });
    await logSupplierSignupSystemEvent(db, {
      requestId,
      event: "supplier_signup_approved",
      message: "Supplier signup request approved.",
      meta: {
        supplier_id: supplierId,
        supplier_user_id: userId,
        invite_email_sent: inviteEmailSent,
        whatsapp_sent: whatsapp.whatsappSent,
        manual_supplier_setup_required: manualSupplierSetupRequired,
      },
    });
    await writeAdminAuditLog(db, {
      adminId: auth.userId,
      action: "approve_supplier_request",
      entityType: "supplier_signup_request",
      entityId: requestId,
      message: "Approved supplier signup request.",
      meta: {
        supplier_id: supplierId,
        supplier_user_id: userId,
        recovery_link_sent: Boolean(recoveryLink),
        invite_email_sent: inviteEmailSent,
        whatsapp_sent: whatsapp.whatsappSent,
        manual_supplier_setup_required: manualSupplierSetupRequired,
      },
    });

    return apiSuccess(req, {
      request_id: requestId,
      status: "approved",
      supplier_id: supplierId,
      supplier_user_id: userId,
      recovery_link_sent: Boolean(recoveryLink),
      invite_email_sent: inviteEmailSent,
      whatsapp_sent: whatsapp.whatsappSent,
      whatsapp_skipped: whatsapp.whatsappSkipped,
      manual_supplier_setup_required: manualSupplierSetupRequired,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }
    return apiError(req, 500, "approve_failed", "Failed to approve supplier request.");
  }
}
