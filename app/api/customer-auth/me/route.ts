import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import { getCustomerById } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";

export async function GET(req: Request) {
  const session = getCustomerSessionFromRequest(req);
  if (!session) {
    return apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  const customer = getCustomerById(session.id);
  if (!customer) {
    return apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  return apiSuccess(req, {
    user: {
      id: customer.id,
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      provider: customer.provider,
    },
  });
}
