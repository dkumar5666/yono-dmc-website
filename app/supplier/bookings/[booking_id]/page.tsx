import { requireRole } from "@/lib/auth/requireRole";
import SupplierBookingDetailClient from "./supplier-booking-detail-client";

export const dynamic = "force-dynamic";

type Params = { booking_id: string };

export default async function SupplierBookingDetailPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  await requireRole("supplier", "/supplier/bookings");
  const resolved = "then" in params ? await params : params;
  const bookingId = decodeURIComponent(resolved.booking_id ?? "");
  return <SupplierBookingDetailClient bookingId={bookingId} />;
}

