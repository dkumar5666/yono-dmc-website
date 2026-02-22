import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import { getCustomerById } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { listBookings } from "@/lib/backend/store";

function normalizeEmail(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

function normalizePhone(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

export async function GET(req: Request) {
  try {
    const session = getCustomerSessionFromRequest(req);
    if (!session) {
      return apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
    }

    const customer = getCustomerById(session.id);
    if (!customer) {
      return apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
    }

    const customerEmail = normalizeEmail(customer.email);
    const customerPhone = normalizePhone(customer.phone);

    const bookings = await listBookings();
    const matched = bookings.filter((item) => {
      const bookingEmail = normalizeEmail(item.contact.email);
      const bookingPhone = normalizePhone(item.contact.phone);

      const emailMatch =
        customerEmail.length > 0 && bookingEmail.length > 0 && customerEmail === bookingEmail;
      const phoneMatch =
        customerPhone.length > 0 && bookingPhone.length > 0 && customerPhone === bookingPhone;

      return emailMatch || phoneMatch;
    });

    return apiSuccess(req, { bookings: matched });
  } catch {
    return apiError(req, 500, "TRIPS_FETCH_ERROR", "Failed to fetch trips.");
  }
}

