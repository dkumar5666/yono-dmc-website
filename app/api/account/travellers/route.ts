import { apiError, apiSuccess } from "@/lib/backend/http";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import {
  createCustomerTraveller,
  deleteCustomerTraveller,
  listCustomerTravellers,
  updateCustomerTraveller,
} from "@/lib/backend/customerAccount";

async function requireCustomer(req: Request): Promise<string | null> {
  const session = readSupabaseSessionFromRequest(req);
  if (!session?.userId) return null;
  const profile = await getIdentityProfileByUserId(session.userId);
  const role = profile?.role || session.role || "customer";
  if (role !== "customer") return null;
  return session.userId;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  const userId = await requireCustomer(req);
  if (!userId) return apiError(req, 401, "unauthorized", "Customer login required.");

  const rows = await listCustomerTravellers(userId);
  return apiSuccess(req, { rows });
}

export async function POST(req: Request) {
  const userId = await requireCustomer(req);
  if (!userId) return apiError(req, 401, "unauthorized", "Customer login required.");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = safeString(body.name);
  if (!name) {
    return apiError(req, 400, "name_required", "Traveller name is required.");
  }

  const created = await createCustomerTraveller(userId, {
    name,
    passport_no: safeString(body.passport_no) || undefined,
    expiry_date: safeString(body.expiry_date) || undefined,
    relationship: safeString(body.relationship) || undefined,
  });
  if (!created) {
    return apiError(req, 503, "traveller_unavailable", "Could not save traveller right now.");
  }

  return apiSuccess(req, { row: created }, 201);
}

export async function PATCH(req: Request) {
  const userId = await requireCustomer(req);
  if (!userId) return apiError(req, 401, "unauthorized", "Customer login required.");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const travellerId = safeString(body.id);
  if (!travellerId) {
    return apiError(req, 400, "traveller_id_required", "Traveller id is required.");
  }

  const updated = await updateCustomerTraveller(userId, travellerId, body);
  if (!updated) {
    return apiError(req, 404, "traveller_not_found", "Traveller not found.");
  }

  return apiSuccess(req, { row: updated });
}

export async function DELETE(req: Request) {
  const userId = await requireCustomer(req);
  if (!userId) return apiError(req, 401, "unauthorized", "Customer login required.");

  const url = new URL(req.url);
  const travellerId = safeString(url.searchParams.get("id"));
  if (!travellerId) {
    return apiError(req, 400, "traveller_id_required", "Traveller id is required.");
  }

  const removed = await deleteCustomerTraveller(userId, travellerId);
  if (!removed) {
    return apiError(req, 404, "traveller_not_found", "Traveller not found.");
  }

  return apiSuccess(req, { deleted: true });
}
