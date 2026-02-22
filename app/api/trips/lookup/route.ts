import { apiError, apiSuccess } from "@/lib/backend/http";
import { listBookings } from "@/lib/backend/store";

interface LookupBody {
  email?: string;
  itineraryNumber?: string;
}

function normalizeEmail(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

function normalizeReference(input: string | null | undefined): string {
  return (input ?? "").trim().toUpperCase();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LookupBody;
    const email = normalizeEmail(body.email);
    const itineraryNumber = normalizeReference(body.itineraryNumber);

    if (!email || !itineraryNumber) {
      return apiError(
        req,
        400,
        "INPUT_REQUIRED",
        "Email and itinerary number are required."
      );
    }

    const bookings = await listBookings();
    const found = bookings.find(
      (item) =>
        normalizeEmail(item.contact.email) === email &&
        normalizeReference(item.reference) === itineraryNumber
    );

    if (!found) {
      return apiError(
        req,
        404,
        "BOOKING_NOT_FOUND",
        "No booking found. Please check your email and itinerary number."
      );
    }

    return apiSuccess(req, { booking: found });
  } catch {
    return apiError(req, 500, "BOOKING_LOOKUP_ERROR", "Failed to find booking.");
  }
}

