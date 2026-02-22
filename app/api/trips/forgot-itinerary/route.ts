import { apiError, apiSuccess } from "@/lib/backend/http";
import { listBookings } from "@/lib/backend/store";

interface ForgotItineraryBody {
  email?: string;
}

function normalizeEmail(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ForgotItineraryBody;
    const email = normalizeEmail(body.email);

    if (!email) {
      return apiError(req, 400, "EMAIL_REQUIRED", "Email address is required.");
    }

    const bookings = await listBookings();
    const matches = bookings.filter(
      (booking) => normalizeEmail(booking.contact.email) === email
    );

    return apiSuccess(req, {
      sent: true,
      count: matches.length,
      message:
        "If an itinerary exists for this email, details will be sent to your inbox.",
    });
  } catch {
    return apiError(
      req,
      500,
      "FORGOT_ITINERARY_ERROR",
      "Failed to process itinerary request."
    );
  }
}

