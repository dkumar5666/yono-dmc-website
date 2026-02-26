export type CabinClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

export interface FlightSearchRequest {
  from: string;
  to: string;
  date: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  infants?: number;
  travelClass?: CabinClass;
  nonStop?: boolean;
  currency?: string;
  max?: number;
}

export interface FlightSegmentSummary {
  from: string;
  to: string;
  departureAt: string;
  arrivalAt: string;
  carrierCode: string;
  flightNumber: string;
  duration: string;
}

export interface FlightItinerarySummary {
  duration: string;
  stops: number;
  segments: FlightSegmentSummary[];
}

export interface FlightOfferSummary {
  id: string;
  source: "amadeus";
  currency: string;
  totalPrice: number;
  validatingAirlineCodes: string[];
  itineraries: FlightItinerarySummary[];
  raw: unknown;
}

export type BookingType = "flight" | "hotel";
export type BookingStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "confirmed"
  | "failed"
  | "cancelled";

export interface BookingStatusEvent {
  status: BookingStatus;
  at: string;
  note?: string;
}

export interface BookingContact {
  name: string;
  email: string;
  phone: string;
}

export interface Traveler {
  firstName: string;
  lastName: string;
  dob?: string;
  gender?: "M" | "F" | "X";
  passportNumber?: string;
}

export interface BookingPayload {
  type: BookingType;
  offerId: string;
  offerSnapshot: unknown;
  amount: number;
  currency: string;
  contact: BookingContact;
  travelers: Traveler[];
  notes?: string;
}

export interface BookingRecord {
  id: string;
  reference: string;
  type: BookingType;
  status: BookingStatus;
  amount: number;
  currency: string;
  contact: BookingContact;
  travelers: Traveler[];
  offerId: string;
  offerSnapshot: unknown;
  paymentIntentId?: string;
  providerPaymentId?: string;
  amadeusOrderId?: string;
  hotelConfirmationNumber?: string;
  hotelSupplierBookingId?: string;
  pnr?: string;
  ticketNumbers?: string[];
  issuedAt?: string;
  issuedBy?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  draftAt?: string;
  pendingPaymentAt?: string;
  paidAt?: string;
  confirmedAt?: string;
  failedAt?: string;
  statusTimeline?: BookingStatusEvent[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingListFilters {
  status?: BookingStatus;
  from?: string;
  to?: string;
}

export interface BookingStatusTransitionResult {
  booking: BookingRecord | null;
  error?: string;
}

export type PaymentStatus =
  | "created"
  | "requires_action"
  | "succeeded"
  | "failed";

export interface PaymentIntentRecord {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: "manual";
  providerPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}
