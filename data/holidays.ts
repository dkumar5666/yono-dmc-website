export interface Holiday {
  slug: string;
  title: string;
  description: string;
  image: string;
  itinerary?: string[];
  priceFrom?: string;
}

export const holidays: Holiday[] = [
  {
    slug: "dubai",
    title: "Dubai Holiday Packages",
    description:
      "Luxury city tours, desert safari, Burj Khalifa, cruises & shopping.",
    image: "/images/destinations/dubai.png",
  },
  {
    slug: "bali",
    title: "Bali Holiday Packages",
    description:
      "Beaches, temples, honeymoon resorts & private villas.",
    image: "/images/destinations/bali.png",
  },
  {
    slug: "singapore",
    title: "Singapore Holiday Packages",
    description:
      "Universal Studios, Sentosa, Marina Bay & family attractions.",
    image: "/images/destinations/singapore.png",
  },
  {
    slug: "malaysia",
    title: "Malaysia Holiday Packages",
    description:
      "Kuala Lumpur, Genting, Langkawi & budget-friendly tours.",
    image: "/images/destinations/malaysia.png",
  },
];
