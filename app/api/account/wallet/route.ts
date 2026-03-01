import { apiError, apiSuccess } from "@/lib/backend/http";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import { getCustomerWallet } from "@/lib/backend/customerAccount";

async function requireCustomer(req: Request): Promise<string | null> {
  const session = readSupabaseSessionFromRequest(req);
  if (!session?.userId) return null;
  const profile = await getIdentityProfileByUserId(session.userId);
  const role = profile?.role || session.role || "customer";
  if (role !== "customer") return null;
  return session.userId;
}

export async function GET(req: Request) {
  const userId = await requireCustomer(req);
  if (!userId) return apiError(req, 401, "unauthorized", "Customer login required.");

  const wallet = await getCustomerWallet(userId);
  return apiSuccess(req, {
    wallet: wallet || {
      customer_id: userId,
      balance: 0,
      tier: "Explorer",
    },
  });
}
