export type OfferCategory =
  | "flights"
  | "stays"
  | "packages"
  | "things-to-do"
  | "cabs"
  | "trains"
  | "bus"
  | "forex"
  | "cruise"
  | "insurance"
  | "visa";

export type OfferFilterKey = "all" | OfferCategory;

export type OfferItem = {
  id: string;
  category: OfferCategory;
  title: string;
  description: string;
  code: string;
  ctaLabel: string;
  href: string;
  destination: string;
  image: string;
  validUntil: string;
};

export const offerCategoryMeta: Record<
  OfferCategory,
  {
    label: string;
    href: string;
  }
> = {
  flights: { label: "Flights", href: "/flights" },
  stays: { label: "Stays", href: "/hotels" },
  packages: { label: "Packages", href: "/holidays" },
  "things-to-do": { label: "Attractions", href: "/things-to-do" },
  cabs: { label: "Cabs", href: "/cabs" },
  trains: { label: "Trains", href: "/trains" },
  bus: { label: "Bus", href: "/bus" },
  forex: { label: "Forex", href: "/forex" },
  cruise: { label: "Cruise", href: "/cruise" },
  insurance: { label: "Insurance", href: "/insurance" },
  visa: { label: "Visa", href: "/visa" },
};

export const offerFilterOrder: OfferFilterKey[] = [
  "all",
  "flights",
  "stays",
  "packages",
  "things-to-do",
  "cabs",
  "trains",
  "bus",
  "forex",
  "visa",
  "cruise",
  "insurance",
];

export const offers: OfferItem[] = [
  {
    id: "off-flights-1",
    category: "flights",
    title: "Up to INR 4,000 off on international flight fares",
    description:
      "Apply this code on selected sectors to Dubai, Singapore, and Kuala Lumpur.",
    code: "FLYDMC4000",
    ctaLabel: "Book Flight",
    href: "/flights",
    destination: "United Arab Emirates",
    image: "/api/images/business-class-flight-offer",
    validUntil: "2026-12-31",
  },
  {
    id: "off-flights-2",
    category: "flights",
    title: "Domestic flight saver up to 12% for early bookings",
    description:
      "Limited-period promo for domestic India routes when booked 14+ days in advance.",
    code: "INDIADMC12",
    ctaLabel: "Search Flights",
    href: "/flights",
    destination: "India",
    image: "/api/images/domestic-flight-window-seat",
    validUntil: "2026-11-30",
  },
  {
    id: "off-stays-1",
    category: "stays",
    title: "Save up to 15% on premium hotels and stays",
    description:
      "Selected partner hotels in Dubai, Bali, and Singapore now available on deal rates.",
    code: "STAYDMC15",
    ctaLabel: "Explore Stays",
    href: "/hotels",
    destination: "United Arab Emirates",
    image: "/api/images/luxury-resort-pool-stay",
    validUntil: "2026-10-15",
  },
  {
    id: "off-stays-2",
    category: "stays",
    title: "Villa and apartment stay bundle with breakfast",
    description:
      "Flexible stay package for families including home stay, apartment, and villa options.",
    code: "FAMILYSTAY",
    ctaLabel: "Find Stays",
    href: "/hotels",
    destination: "Indonesia",
    image: "/api/images/villa-ocean-view-bali",
    validUntil: "2026-12-10",
  },
  {
    id: "off-packages-1",
    category: "packages",
    title: "Japan and Korea package savings up to INR 9,999",
    description:
      "Best-value package fare on select departures with curated itinerary support.",
    code: "ASIAPACK9999",
    ctaLabel: "View Packages",
    href: "/holidays",
    destination: "Japan",
    image: "/api/images/japan-korea-holiday-package",
    validUntil: "2026-09-30",
  },
  {
    id: "off-packages-2",
    category: "packages",
    title: "UAE and Malaysia twin package with transfer perks",
    description:
      "Package includes selected sightseeing, airport pickup, and special contract rates.",
    code: "TWINCITYDM",
    ctaLabel: "Browse Packages",
    href: "/holidays",
    destination: "United Arab Emirates",
    image: "/api/images/dubai-malaysia-holiday-offer",
    validUntil: "2026-12-20",
  },
  {
    id: "off-things-1",
    category: "things-to-do",
    title: "Dubai attractions combo with instant ticket discount",
    description:
      "Bundle top experiences like Burj Khalifa, museum access, and adventure entries.",
    code: "DUBAIFUN",
    ctaLabel: "View Activities",
    href: "/things-to-do?destination=Dubai",
    destination: "United Arab Emirates",
    image: "/api/images/dubai-things-to-do-night-view",
    validUntil: "2026-08-31",
  },
  {
    id: "off-things-2",
    category: "things-to-do",
    title: "Theme park and city activity passes in Singapore",
    description:
      "Get curated passes for families and groups with priority booking assistance.",
    code: "SGACTIVITY",
    ctaLabel: "Explore Attractions",
    href: "/things-to-do?destination=Singapore",
    destination: "Singapore",
    image: "/api/images/singapore-theme-park-offer",
    validUntil: "2026-11-05",
  },
  {
    id: "off-cabs-1",
    category: "cabs",
    title: "Airport and city transfer cabs from flat rates",
    description:
      "Pre-book transfer rides for international arrivals with fixed and transparent pricing.",
    code: "CABDMC",
    ctaLabel: "Book Cabs",
    href: "/cabs",
    destination: "United Arab Emirates",
    image: "/api/images/airport-transfer-cab-service",
    validUntil: "2026-12-31",
  },
  {
    id: "off-cabs-2",
    category: "cabs",
    title: "Private city rides for full-day sightseeing",
    description:
      "Reserve private vehicle with driver for day tours and family itineraries.",
    code: "PRIVATERIDE",
    ctaLabel: "Plan Transfer",
    href: "/cabs",
    destination: "Malaysia",
    image: "/api/images/private-city-transfer-car",
    validUntil: "2026-10-30",
  },
  {
    id: "off-trains-1",
    category: "trains",
    title: "Rail fare offers on selected tourist routes",
    description:
      "Seasonal train deal support for itineraries that combine rail and stays.",
    code: "RAILDMC",
    ctaLabel: "Check Trains",
    href: "/trains",
    destination: "India",
    image: "/api/images/scenic-train-journey-offer",
    validUntil: "2026-09-15",
  },
  {
    id: "off-trains-2",
    category: "trains",
    title: "Intercity train add-on discount with holiday package",
    description:
      "Add train connections inside your package and unlock bundled contract rates.",
    code: "PACKRAIL",
    ctaLabel: "Open Trains",
    href: "/trains",
    destination: "Japan",
    image: "/api/images/japan-train-ticket-offer",
    validUntil: "2026-11-18",
  },
  {
    id: "off-bus-1",
    category: "bus",
    title: "Bus booking support with flexible departure slots",
    description:
      "Limited-time booking fee waiver on selected intercity and airport bus transfers.",
    code: "BUSSMART",
    ctaLabel: "Find Bus",
    href: "/bus",
    destination: "Malaysia",
    image: "/api/images/intercity-bus-travel-offer",
    validUntil: "2026-12-12",
  },
  {
    id: "off-forex-1",
    category: "forex",
    title: "Reduced markup on travel currency exchange",
    description:
      "Lock better exchange rates for AED, SGD, USD, and MYR before departure.",
    code: "FXSAVE",
    ctaLabel: "Check Forex",
    href: "/forex",
    destination: "Singapore",
    image: "/api/images/travel-forex-currency-card",
    validUntil: "2026-12-31",
  },
  {
    id: "off-forex-2",
    category: "forex",
    title: "Multi-currency card issuance fee waiver",
    description:
      "Get your travel card setup with lower onboarding charges for limited time.",
    code: "FOREXCARD",
    ctaLabel: "Open Forex",
    href: "/forex",
    destination: "Malaysia",
    image: "/api/images/forex-card-travel-wallet",
    validUntil: "2026-09-25",
  },
  {
    id: "off-visa-1",
    category: "visa",
    title: "Visa assistance offer for high-volume destinations",
    description:
      "Faster documentation screening and advisory support for selected countries.",
    code: "VISAFAST",
    ctaLabel: "Apply Visa",
    href: "/visa",
    destination: "United Arab Emirates",
    image: "/api/images/visa-passport-processing",
    validUntil: "2026-12-05",
  },
  {
    id: "off-cruise-1",
    category: "cruise",
    title: "Early-bird cruise departures with added value benefits",
    description:
      "Reserve selected cruise departures and unlock complimentary onboard perks.",
    code: "CRUISEDMC",
    ctaLabel: "Explore Cruise",
    href: "/cruise",
    destination: "Singapore",
    image: "/api/images/luxury-cruise-deck-offer",
    validUntil: "2026-10-10",
  },
  {
    id: "off-insurance-1",
    category: "insurance",
    title: "Travel insurance premium benefit on annual plans",
    description:
      "Secure comprehensive trip coverage with discounted annual policy pricing.",
    code: "SAFETRIP",
    ctaLabel: "Check Insurance",
    href: "/insurance",
    destination: "Japan",
    image: "/api/images/travel-insurance-family-cover",
    validUntil: "2026-12-31",
  },
];

export function isOfferCategory(value: string | null | undefined): value is OfferCategory {
  if (!value) return false;
  return value in offerCategoryMeta;
}
