export interface TravelTip {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  image: string;
  category: string;
  readTime: string;
}

export const travelTips: TravelTip[] = [
  {
    slug: "best-time-to-visit-japan",
    title: "Best Time to Visit Japan in 2027",
    excerpt:
      "A practical month-by-month guide for cherry blossoms, autumn foliage, and festival travel planning.",
    date: "2026-12-20",
    image: "/api/images/japan-travel-guide",
    category: "Destination Guide",
    readTime: "5 min read",
  },
  {
    slug: "dubai-first-timer-checklist",
    title: "Dubai First-Timer Checklist",
    excerpt:
      "Everything you should confirm before flying: documents, local transport, budget planning, and top attractions.",
    date: "2026-12-28",
    image: "/api/images/dubai-travel-guide",
    category: "Travel Tips",
    readTime: "4 min read",
  },
  {
    slug: "bali-honeymoon-planning-guide",
    title: "How to Plan a Bali Honeymoon",
    excerpt:
      "Build a smooth romantic itinerary with villa picks, beach timing, activity balance, and local experiences.",
    date: "2027-01-05",
    image: "/api/images/bali-travel-guide",
    category: "Honeymoon",
    readTime: "6 min read",
  },
  {
    slug: "singapore-budget-itinerary-4-days",
    title: "Singapore on a Budget: 4-Day Plan",
    excerpt:
      "A smart route covering city highlights, food hubs, Sentosa, and transport hacks without overspending.",
    date: "2027-01-10",
    image: "/api/images/singapore-travel-guide",
    category: "Budget Travel",
    readTime: "5 min read",
  },
  {
    slug: "malaysia-family-trip-guide",
    title: "Malaysia Family Trip Planning Guide",
    excerpt:
      "How to combine Kuala Lumpur, Genting, and Langkawi for a family-friendly and low-stress holiday.",
    date: "2027-01-15",
    image: "/api/images/malaysia-travel-guide",
    category: "Family Travel",
    readTime: "5 min read",
  },
  {
    slug: "visa-documents-checklist",
    title: "Visa Document Checklist Before You Apply",
    excerpt:
      "Avoid common rejections with a complete pre-submission checklist for passport, finance, and travel proofs.",
    date: "2027-01-18",
    image: "/api/images/visa-travel-guide",
    category: "Visa Help",
    readTime: "4 min read",
  },
];

