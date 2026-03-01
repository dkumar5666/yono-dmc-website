import { apiError, apiSuccess } from "@/lib/backend/http";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import {
  ensureCustomerProfile,
  getCustomerProfile,
  getCustomerWallet,
  listCustomerTravellers,
  upsertCustomerProfile,
} from "@/lib/backend/customerAccount";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function requireCustomer(req: Request): Promise<{
  userId: string;
  email?: string;
  phone?: string;
} | null> {
  const session = readSupabaseSessionFromRequest(req);
  if (!session?.userId) return null;
  const profile = await getIdentityProfileByUserId(session.userId);
  const role = profile?.role || session.role || "customer";
  if (role !== "customer") return null;
  return {
    userId: session.userId,
    email: session.email || profile?.email || undefined,
    phone: session.phone || profile?.phone || undefined,
  };
}

export async function GET(req: Request) {
  const auth = await requireCustomer(req);
  if (!auth) {
    return apiError(req, 401, "unauthorized", "Customer login required.");
  }

  const profile = (await ensureCustomerProfile(auth.userId)) || (await getCustomerProfile(auth.userId));
  const travellers = await listCustomerTravellers(auth.userId);
  const wallet = await getCustomerWallet(auth.userId);

  return apiSuccess(req, {
    profile: profile
      ? {
          ...profile,
          email: profile.email || auth.email || null,
          phone: profile.phone || auth.phone || null,
          phone_verified: profile.phone_verified || Boolean(profile.phone || auth.phone),
        }
      : null,
    travellers,
    wallet,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireCustomer(req);
  if (!auth) {
    return apiError(req, 401, "unauthorized", "Customer login required.");
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  const passThroughKeys = [
    "full_name",
    "nationality",
    "city",
    "dob",
    "preferred_airport",
    "passport_no",
    "passport_expiry",
    "pan",
    "travel_type",
    "profile_completed",
  ];
  for (const key of passThroughKeys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      patch[key] = body[key];
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    patch.phone = safeString(body.phone) || null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "phone_verified")) {
    patch.phone_verified = Boolean(body.phone_verified);
  }
  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    patch.email = safeString(body.email).toLowerCase() || null;
  }

  const updated = await upsertCustomerProfile(auth.userId, patch);
  if (!updated) {
    return apiError(req, 503, "profile_unavailable", "Customer profile is unavailable right now.");
  }

  return apiSuccess(req, { profile: updated });
}
