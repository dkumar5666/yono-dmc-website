import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import { getCustomerById } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import { getCustomerProfile, getCustomerProfileCompletionStatus } from "@/lib/backend/customerAccount";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  safeLog(
    "auth.customer.me.requested",
    {
      requestId,
      route: "/api/customer-auth/me",
    },
    req
  );

  const supabaseSession = readSupabaseSessionFromRequest(req);
  if (supabaseSession) {
    const profile = await getIdentityProfileByUserId(supabaseSession.userId);
    const role = profile?.role || supabaseSession.role || "customer";
    const customerProfile = role === "customer" ? await getCustomerProfile(supabaseSession.userId) : null;
    const profileCompleted =
      role === "customer"
        ? await getCustomerProfileCompletionStatus(supabaseSession.userId)
        : true;
    const phone =
      supabaseSession.phone ||
      customerProfile?.phone ||
      profile?.phone ||
      undefined;
    const needsPhoneVerification = role === "customer" && !phone;
    const response = apiSuccess(req, {
      user: {
        id: supabaseSession.userId,
        name: supabaseSession.fullName || customerProfile?.full_name || profile?.full_name || "User",
        email: supabaseSession.email || customerProfile?.email || profile?.email || undefined,
        phone,
        provider: "supabase",
        role,
      },
      needs_phone_verification: needsPhoneVerification,
      profile_completed: profileCompleted,
    });
    response.headers.set("x-request-id", requestId);
    safeLog(
      "auth.customer.me.success",
      {
        requestId,
        route: "/api/customer-auth/me",
        outcome: "success",
        authProvider: "supabase",
      },
      req
    );
    return response;
  }

  const session = getCustomerSessionFromRequest(req);
  if (!session) {
    safeLog(
      "auth.customer.me.failed",
      {
        requestId,
        route: "/api/customer-auth/me",
        outcome: "fail",
        reason: "unauthorized_no_session",
      },
      req
    );
    const response = apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const customer = getCustomerById(session.id);
  if (!customer) {
    safeLog(
      "auth.customer.me.failed",
      {
        requestId,
        route: "/api/customer-auth/me",
        outcome: "fail",
        reason: "unauthorized_customer_not_found",
      },
      req
    );
    const response = apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = apiSuccess(req, {
    user: {
      id: customer.id,
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      provider: customer.provider,
      role: "customer",
    },
    needs_phone_verification: false,
    profile_completed: true,
  });
  response.headers.set("x-request-id", requestId);
  safeLog(
    "auth.customer.me.success",
    {
      requestId,
      route: "/api/customer-auth/me",
      outcome: "success",
    },
    req
  );
  return response;
}
