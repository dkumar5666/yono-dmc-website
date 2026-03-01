import { apiError, apiSuccess } from "@/lib/backend/http";
import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import type { CustomerPortalSession } from "@/lib/backend/customerTripsPortal";
import { getCustomerTripDetail } from "@/lib/backend/customerTripsPortal";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import {
  createCustomerSupportRequest,
  listCustomerSupportRequestsByBooking,
  SupportSystemUnavailableError,
} from "@/lib/backend/supportRequests";
import { recordAnalyticsEvent } from "@/lib/system/opsTelemetry";

const ALLOWED_CATEGORIES = new Set(["voucher", "payment", "cancellation", "change", "other"]);

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCustomerPortalSession(value: unknown): CustomerPortalSession | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = safeString(row.id);
  const name = safeString(row.name);
  const provider = safeString(row.provider);
  if (!id || !name || (provider !== "google" && provider !== "mobile_otp")) return null;
  return {
    id,
    name,
    email: safeString(row.email) || undefined,
    phone: safeString(row.phone) || undefined,
    provider,
    role: "customer",
  };
}

async function resolveCustomerSession(req: Request): Promise<CustomerPortalSession | null> {
  const supabaseSession = readSupabaseSessionFromRequest(req);
  if (supabaseSession) {
    const profile = await getIdentityProfileByUserId(supabaseSession.userId);
    const role = profile?.role || supabaseSession.role || "customer";
    if (role !== "customer" && role !== "agent") return null;
    return {
      id: supabaseSession.userId,
      name: supabaseSession.fullName || profile?.full_name || "User",
      email: supabaseSession.email || profile?.email || undefined,
      phone: supabaseSession.phone || profile?.phone || undefined,
      provider: "supabase",
      role,
    };
  }

  const rawSession = getCustomerSessionFromRequest(req);
  return asCustomerPortalSession(rawSession);
}

async function verifyOwnedBooking(session: CustomerPortalSession, bookingId: string) {
  const detail = await getCustomerTripDetail(session, bookingId);
  return detail.booking;
}

export async function GET(req: Request) {
  const session = await resolveCustomerSession(req);
  if (!session) {
    return apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const bookingId = safeString(searchParams.get("booking_id"));
  if (!bookingId) {
    return apiSuccess(req, { rows: [] });
  }

  const booking = await verifyOwnedBooking(session, bookingId);
  if (!booking) {
    return apiError(req, 404, "NOT_FOUND", "Booking not found");
  }

  const rows = await listCustomerSupportRequestsByBooking(session, bookingId);
  return apiSuccess(req, { rows });
}

export async function POST(req: Request) {
  const session = await resolveCustomerSession(req);
  if (!session) {
    return apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  let body: {
    booking_id?: unknown;
    category?: unknown;
    subject?: unknown;
    message?: unknown;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError(req, 400, "BAD_REQUEST", "Invalid request body");
  }

  const bookingId = safeString(body.booking_id);
  const category = safeString(body.category).toLowerCase();
  const subject = safeString(body.subject);
  const message = safeString(body.message);

  if (!bookingId) {
    return apiError(req, 400, "VALIDATION_ERROR", "booking_id is required");
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    return apiError(req, 400, "VALIDATION_ERROR", "Invalid category");
  }
  if (!subject || subject.length < 3) {
    return apiError(req, 400, "VALIDATION_ERROR", "Subject must be at least 3 characters");
  }
  if (!message || message.length < 10) {
    return apiError(req, 400, "VALIDATION_ERROR", "Message must be at least 10 characters");
  }

  const booking = await verifyOwnedBooking(session, bookingId);
  if (!booking) {
    return apiError(req, 404, "NOT_FOUND", "Booking not found");
  }

  try {
    const created = await createCustomerSupportRequest({
      booking_id: bookingId,
      customer_id: session.id,
      customer_email: session.email,
      customer_phone: session.phone,
      category: category as "voucher" | "payment" | "cancellation" | "change" | "other",
      subject,
      message,
    });
    await recordAnalyticsEvent({
      event: "support_request_created",
      leadId: null,
      bookingId,
      source: "customer_portal",
      status: "open",
      meta: {
        category,
      },
    });
    return apiSuccess(req, { ok: true, id: created.id });
  } catch (error) {
    if (error instanceof SupportSystemUnavailableError) {
      return apiError(req, 503, "SUPPORT_UNAVAILABLE", "Support system not available yet");
    }
    return apiError(req, 500, "SUPPORT_CREATE_FAILED", "Failed to create support request");
  }
}
