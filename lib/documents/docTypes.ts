import "server-only";

export type BookingDocKey = "invoice" | "booking_confirmation" | "itinerary_summary";

export interface BookingDocDefinition {
  key: BookingDocKey;
  dbType: "invoice" | "voucher" | "itinerary";
  label: string;
  requiresSupplierConfirmation: boolean;
  storageName: string;
}

export const BOOKING_DOC_TYPES: BookingDocDefinition[] = [
  {
    key: "invoice",
    dbType: "invoice",
    label: "Invoice",
    requiresSupplierConfirmation: false,
    storageName: "invoice",
  },
  {
    key: "booking_confirmation",
    dbType: "voucher",
    label: "Booking Confirmation",
    requiresSupplierConfirmation: true,
    storageName: "booking_confirmation",
  },
  {
    key: "itinerary_summary",
    dbType: "itinerary",
    label: "Itinerary Summary",
    requiresSupplierConfirmation: true,
    storageName: "itinerary_summary",
  },
];
