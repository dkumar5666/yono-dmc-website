import { siteConfig } from "@/data/site";

export type AttractionCategory =
  | "Observation & Landmark"
  | "Theme Park"
  | "Museum & Culture"
  | "Nature & Wildlife"
  | "Cruise & Tour"
  | "Adventure";

interface AttractionCountrySource {
  key: string;
  name: string;
  tagline: string;
  cities: string[];
  aliases: string[];
  items: readonly string[];
}

export interface AttractionCountry {
  key: string;
  name: string;
  tagline: string;
  cities: string[];
}

export interface TicketedAttraction {
  id: string;
  slug: string;
  title: string;
  countryKey: string;
  countryName: string;
  tagline: string;
  cities: string[];
  location: string;
  image: string;
  rating: number;
  reviews: number;
  category: AttractionCategory;
  duration: string;
  timing: string;
  description: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  cancellationPolicy: string;
  meetingPoint: string;
  mapQuery: string;
  detailsHref: string;
  ticketsHref: string;
}

const ATTRACTION_COUNTRIES: AttractionCountrySource[] = [
  {
    key: "japan",
    name: "Japan",
    tagline: "Where Tradition Meets Futuristic Innovation",
    cities: ["Tokyo", "Kyoto", "Osaka", "Hiroshima"],
    aliases: ["japan", "tokyo", "kyoto", "osaka", "hiroshima", "hakone"],
    items: [
      "Tokyo Skytree Tembo Deck Admission Ticket",
      "teamLab Planets Tokyo Admission Ticket",
      "Universal Studios Japan Studio Pass (1-Day)",
      "Warner Bros. Studio Tour Tokyo Admission Ticket",
      "Osaka Castle Main Tower Admission Ticket",
      "Himeji Castle Admission Ticket",
      "Hiroshima Peace Memorial Museum Admission Ticket",
      "Ghibli Museum Admission Ticket",
      "Hakone Ropeway Ticket",
      "Lake Ashi Sightseeing Cruise Ticket",
      "Tokyo Disneyland 1-Day Passport",
      "Tokyo DisneySea 1-Day Passport",
      "Shibuya Sky Observation Deck Admission Ticket",
      "Umeda Sky Building Kuchu Teien Observatory Ticket",
      "Jigokudani Snow Monkey Park Admission Ticket",
      "Nijo Castle Admission Ticket",
      "Kinkaku-ji Temple Admission Fee",
      "Toei Kyoto Studio Park Admission Ticket",
      "Fuji-Q Highland 1-Day Pass",
      "Edo Wonderland Nikko Admission Ticket",
    ],
  },
  {
    key: "uae",
    name: "United Arab Emirates",
    tagline: "Luxury, Skyscrapers & Desert Adventures",
    cities: ["Dubai", "Abu Dhabi", "Sharjah"],
    aliases: ["uae", "united arab emirates", "dubai", "abu dhabi", "sharjah", "emirates"],
    items: [
      "Burj Khalifa At The Top (Level 124 & 125) Admission Ticket",
      "Dubai Frame Admission Ticket",
      "Ski Dubai Snow Classic Ticket",
      "Aquaventure Waterpark Admission Ticket",
      "The View at The Palm - General Admission",
      "Dubai Aquarium & Underwater Zoo Admission Ticket",
      "IMG Worlds of Adventure Admission Ticket",
      "Global Village Entry Ticket",
      "Miracle Garden Entry Ticket",
      "Museum of the Future Admission Ticket",
      "Dubai Parks & Resorts - Motiongate 1-Day Ticket",
      "Ferrari World Abu Dhabi Admission Ticket",
      "Warner Bros. World Abu Dhabi Admission Ticket",
      "Louvre Abu Dhabi General Admission",
      "Ain Dubai Observation Wheel Ticket",
      "Sky Views Edge Walk Admission Ticket",
      "Dubai Safari Park Admission Ticket",
      "Green Planet Dubai Admission Ticket",
      "Legoland Dubai 1-Day Ticket",
      "Yas Waterworld Admission Ticket",
    ],
  },
  {
    key: "bali",
    name: "Indonesia (Bali)",
    tagline: "Island of Gods & Tropical Romance",
    cities: ["Ubud", "Kuta", "Seminyak", "Nusa Penida"],
    aliases: ["bali", "indonesia", "ubud", "kuta", "seminyak", "nusa penida"],
    items: [
      "Bali Safari & Marine Park Admission Ticket",
      "Waterbom Bali Day Pass",
      "Uluwatu Temple Entrance Ticket",
      "Tanah Lot Temple Entrance Ticket",
      "Tirta Empul Temple Entrance Ticket",
      "Lempuyang Temple Entrance Ticket",
      "Mount Batur Jeep Tour Ticket",
      "Bali Swing Admission Ticket",
      "Nusa Penida West Tour Package Ticket",
      "Tegenungan Waterfall Entrance Ticket",
      "Besakih Temple Entrance Ticket",
      "Ulun Danu Beratan Temple Entrance Ticket",
      "Garuda Wisnu Kencana Cultural Park Admission Ticket",
      "Bali Zoo Admission Ticket",
      "Devdan Show Bali Admission Ticket",
      "Ayung River Rafting Ticket",
      "Kecak Dance Uluwatu Ticket",
      "Jatiluwih Rice Terrace Entrance Ticket",
      "Handara Gate Entrance Ticket",
      "Lovina Dolphin Watching Tour Ticket",
    ],
  },
  {
    key: "singapore",
    name: "Singapore",
    tagline: "Futuristic City with Tropical Charm",
    cities: ["Singapore City", "Sentosa Island"],
    aliases: ["singapore", "sentosa"],
    items: [
      "Universal Studios Singapore 1-Day Ticket",
      "Gardens by the Bay (Flower Dome & Cloud Forest) Admission Ticket",
      "Singapore Zoo Admission Ticket",
      "Night Safari Admission Ticket",
      "River Wonders Admission Ticket",
      "S.E.A. Aquarium Admission Ticket",
      "Adventure Cove Waterpark Admission Ticket",
      "Singapore Flyer Admission Ticket",
      "Marina Bay Sands SkyPark Observation Deck Ticket",
      "Jewel Changi Canopy Park Admission Ticket",
      "Madame Tussauds Singapore Admission Ticket",
      "Wings of Time Standard Seat Ticket",
      "Skyline Luge Sentosa Ticket",
      "Sentosa Cable Car Sky Pass",
      "ArtScience Museum Admission Ticket",
      "Snow City Singapore Admission Ticket",
      "Trick Eye Museum Singapore Admission Ticket",
      "River Cruise Singapore Ticket",
      "Bird Paradise Admission Ticket",
      "Haw Par Villa Admission Ticket",
    ],
  },
  {
    key: "malaysia",
    name: "Malaysia",
    tagline: "Truly Asia - Culture, Cities & Beaches",
    cities: ["Kuala Lumpur", "Langkawi", "Penang", "Genting Highlands"],
    aliases: ["malaysia", "kuala lumpur", "langkawi", "penang", "genting", "genting highlands"],
    items: [
      "Petronas Twin Towers Skybridge & Observation Deck Ticket",
      "KL Tower Observation Deck Ticket",
      "Genting SkyWorlds Theme Park 1-Day Ticket",
      "Langkawi Cable Car (SkyCab) Standard Ticket",
      "Langkawi Sky Bridge Admission Ticket",
      "Sunway Lagoon Theme Park Admission Ticket",
      "Aquaria KLCC Admission Ticket",
      "Penang Hill Funicular Train Ticket",
      "The Habitat Penang Hill Admission Ticket",
      "ESCAPE Penang Admission Ticket",
      "Legoland Malaysia 1-Day Ticket",
      "Desaru Coast Adventure Waterpark Ticket",
      "Batu Caves Cave Villa Admission Ticket",
      "Underwater World Langkawi Admission Ticket",
      "The Top Komtar Penang Admission Ticket",
      "Crocodile Adventureland Langkawi Admission Ticket",
      "Putrajaya Cruise Ticket",
      "Taman Negara Canopy Walkway Ticket",
      "Skytrex Adventure Ticket",
      "Langkawi Island Hopping Tour Ticket",
    ],
  },
  {
    key: "vietnam",
    name: "Vietnam",
    tagline: "Timeless Heritage & Scenic Landscapes",
    cities: ["Hanoi", "Ha Long Bay", "Da Nang", "Ho Chi Minh City"],
    aliases: ["vietnam", "hanoi", "ha long", "halong", "da nang", "ho chi minh", "hoi an"],
    items: [
      "Ba Na Hills Admission Ticket (Including Cable Car)",
      "Ha Long Bay Day Cruise Ticket",
      "Ha Long Bay Overnight Cruise Ticket",
      "Golden Bridge Admission (Ba Na Hills Entry)",
      "Cu Chi Tunnels Entrance Ticket",
      "War Remnants Museum Admission Ticket",
      "Fansipan Cable Car Ticket",
      "VinWonders Phu Quoc Admission Ticket",
      "VinWonders Nha Trang Admission Ticket",
      "Imperial Citadel of Hue Entrance Ticket",
      "Marble Mountains Entrance Ticket",
      "My Son Sanctuary Entrance Ticket",
      "Sun World Halong Complex Admission Ticket",
      "Ninh Binh Trang An Boat Tour Ticket",
      "Ho Chi Minh Mausoleum Complex Entry (Museum Ticket)",
      "Water Puppet Show Hanoi Ticket",
      "Hoi An Ancient Town Entrance Ticket",
      "Mekong Delta Tour Ticket",
      "Cat Ba Island Lan Ha Bay Cruise Ticket",
      "Dalat Alpine Coaster Ticket",
    ],
  },
  {
    key: "thailand",
    name: "Thailand",
    tagline: "Land of Smiles & Island Escapes",
    cities: ["Bangkok", "Phuket", "Krabi", "Chiang Mai"],
    aliases: ["thailand", "bangkok", "phuket", "krabi", "chiang mai", "pattaya"],
    items: [
      "Grand Palace Bangkok Admission Ticket",
      "Wat Pho Admission Ticket",
      "Wat Arun Admission Ticket",
      "Safari World Bangkok Admission Ticket",
      "Chao Phraya River Dinner Cruise Ticket",
      "Phi Phi Island Tour Ticket",
      "James Bond Island Tour Ticket",
      "Coral Island (Koh Larn) Tour Ticket",
      "Tiger Cave Temple Krabi Entrance Ticket",
      "Big Buddha Phuket Admission Ticket",
      "Phuket Fantasea Show Ticket",
      "Andamanda Phuket Waterpark Admission Ticket",
      "Chiang Mai Night Safari Admission Ticket",
      "Elephant Sanctuary Experience Ticket",
      "Ayutthaya Historical Park Entrance Ticket",
      "Erawan National Park Entrance Ticket",
      "Art in Paradise Pattaya Admission Ticket",
      "Sanctuary of Truth Pattaya Admission Ticket",
      "Ramayana Water Park Pattaya Admission Ticket",
      "SEA LIFE Bangkok Ocean World Admission Ticket",
    ],
  },
  {
    key: "south-korea",
    name: "South Korea",
    tagline: "K-Culture, Palaces & Coastal Beauty",
    cities: ["Seoul", "Busan", "Jeju Island", "Incheon"],
    aliases: ["south korea", "korea", "seoul", "busan", "jeju", "incheon"],
    items: [
      "Gyeongbokgung Palace Admission Ticket",
      "N Seoul Tower Observatory Ticket",
      "Lotte World 1-Day Pass",
      "Everland 1-Day Ticket",
      "DMZ Tour Ticket",
      "Nami Island Admission Ticket",
      "COEX Aquarium Admission Ticket",
      "Han River Cruise Ticket",
      "Busan Sky Capsule Ticket",
      "Gamcheon Culture Village Admission Ticket",
      "Bulguksa Temple Admission Ticket",
      "Seongsan Ilchulbong Peak Entrance Ticket",
      "Jeju Aqua Planet Admission Ticket",
      "Trick Eye Museum Seoul Admission Ticket",
      "Garden of Morning Calm Admission Ticket",
      "Petite France Admission Ticket",
      "Seoul Sky (Lotte World Tower Observatory) Ticket",
      "Korean Folk Village Admission Ticket",
      "Incheon Chinatown Walking Tour Ticket",
      "Haeundae Blueline Park Ticket",
    ],
  },
  {
    key: "india",
    name: "India",
    tagline: "Incredible Diversity & Timeless Heritage",
    cities: ["Delhi", "Agra", "Jaipur", "Srinagar"],
    aliases: ["india", "delhi", "agra", "jaipur", "srinagar", "kashmir", "mumbai"],
    items: [
      "Taj Mahal Entrance Ticket",
      "Agra Fort Entrance Ticket",
      "Amber Fort Entrance Ticket",
      "Qutub Minar Entrance Ticket",
      "Red Fort Delhi Entrance Ticket",
      "City Palace Jaipur Entrance Ticket",
      "Mysore Palace Entrance Ticket",
      "Humayun's Tomb Entrance Ticket",
      "Golden Temple Museum Ticket",
      "Ranthambore National Park Safari Permit",
      "Jim Corbett National Park Safari Permit",
      "Kerala Backwater Houseboat Ticket",
      "Gateway of India Ferry Ticket",
      "Elephanta Caves Entrance Ticket",
      "Meenakshi Amman Temple Museum Ticket",
      "Konark Sun Temple Entrance Ticket",
      "Charminar Museum Ticket",
      "Leh Pangong Lake Inner Line Permit",
      "Andaman Cellular Jail Entry Ticket",
      "Sundarbans Boat Safari Ticket",
    ],
  },
  {
    key: "australia",
    name: "Australia",
    tagline: "Urban Icons & Natural Wonders",
    cities: ["Sydney", "Melbourne", "Gold Coast", "Cairns"],
    aliases: ["australia", "sydney", "melbourne", "gold coast", "cairns", "uluru"],
    items: [
      "Sydney Opera House Guided Tour Ticket",
      "Sydney Tower Eye Observation Deck Ticket",
      "Taronga Zoo Sydney Admission Ticket",
      "SEA LIFE Sydney Aquarium Admission Ticket",
      "Scenic World Blue Mountains Unlimited Discovery Pass",
      "Melbourne Skydeck Admission Ticket",
      "Phillip Island Penguin Parade General Viewing Ticket",
      "Great Ocean Road Day Tour Ticket",
      "Dreamworld Gold Coast 1-Day Ticket",
      "Warner Bros. Movie World 1-Day Ticket",
      "Sea World Gold Coast 1-Day Ticket",
      "Great Barrier Reef Full-Day Cruise Ticket",
      "Uluru-Kata Tjuta National Park Entry Pass",
      "Kuranda Scenic Railway Ticket",
      "Cairns Aquarium Admission Ticket",
      "Kangaroo Island Day Tour Ticket",
      "Rottnest Island Ferry Ticket",
      "Daintree Rainforest Guided Tour Ticket",
      "Lone Pine Koala Sanctuary Admission Ticket",
      "Australian Reptile Park Admission Ticket",
    ],
  },
  {
    key: "turkey",
    name: "Turkey",
    tagline: "Where East Meets West",
    cities: ["Istanbul", "Cappadocia", "Antalya", "Pamukkale"],
    aliases: ["turkey", "istanbul", "cappadocia", "antalya", "pamukkale"],
    items: [
      "Hagia Sophia Mosque Entry Ticket",
      "Topkapi Palace Admission Ticket",
      "Basilica Cistern Admission Ticket",
      "Galata Tower Entrance Ticket",
      "Dolmabahce Palace Admission Ticket",
      "Bosphorus Cruise Ticket",
      "Goreme Open-Air Museum Entrance Ticket",
      "Cappadocia Hot Air Balloon Ride Ticket",
      "Kaymakli Underground City Entrance Ticket",
      "Pamukkale Travertines Entrance Ticket",
      "Hierapolis Ancient City Entrance Ticket",
      "Ephesus Ancient City Entrance Ticket",
      "Troy Ancient City Entrance Ticket",
      "Aspendos Theatre Entrance Ticket",
      "Antalya Aquarium Admission Ticket",
      "Princes' Islands Ferry Ticket",
      "Mount Nemrut Entrance Ticket",
      "Bursa Cable Car Ticket",
      "Fethiye Paragliding Ticket",
      "Whirling Dervish Show Ticket",
    ],
  },
  {
    key: "mauritius",
    name: "Mauritius",
    tagline: "Paradise in the Indian Ocean",
    cities: ["Port Louis", "Grand Baie", "Flic-en-Flac", "Le Morne"],
    aliases: ["mauritius", "port louis", "grand baie", "flic en flac", "le morne"],
    items: [
      "Ile aux Cerfs Island Boat Transfer Ticket",
      "Casela Nature Parks Admission Ticket",
      "Chamarel Seven Coloured Earth Entrance Ticket",
      "La Vanille Nature Park Admission Ticket",
      "Blue Bay Marine Park Snorkeling Ticket",
      "Catamaran Cruise Mauritius Ticket",
      "Submarine Tour Mauritius Ticket",
      "Le Morne Brabant Guided Hike Permit",
      "Ebony Forest Reserve Admission Ticket",
      "Pamplemousses Botanical Garden Entrance Ticket",
      "Tamarin Dolphin Watching Tour Ticket",
      "Undersea Walk Mauritius Ticket",
      "Albion Lighthouse Visit Ticket",
      "Black River Gorges Guided Tour Ticket",
      "Trou aux Cerfs Crater Visit Ticket",
      "Grand Bassin (Ganga Talao) Visit Entry",
      "Belle Mare Water Sports Ticket",
      "Mauritius Speedboat Coastal Tour Ticket",
      "Ile aux Aigrettes Nature Reserve Entrance Ticket",
      "Mauritius Helicopter Scenic Flight Ticket",
    ],
  },
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function inferCategory(title: string): AttractionCategory {
  const value = title.toLowerCase();
  if (/(theme park|waterpark|universal studios|disney|warner|legoland|everland|lotte world|dreamworld|movie world)/.test(value)) return "Theme Park";
  if (/(museum|palace|temple|fort|castle|citadel|mausoleum|sanctuary|mosque|city|tomb)/.test(value)) return "Museum & Culture";
  if (/(zoo|wildlife|aquarium|marine|dolphin|safari|national park|nature park|forest)/.test(value)) return "Nature & Wildlife";
  if (/(cruise|ferry|tour|boat|island|railway)/.test(value)) return "Cruise & Tour";
  if (/(balloon|paragliding|coaster|ropeway|cable car|adventure|permit|walk|hike)/.test(value)) return "Adventure";
  return "Observation & Landmark";
}

function inferDuration(category: AttractionCategory): string {
  switch (category) {
    case "Theme Park":
      return "Full Day";
    case "Cruise & Tour":
      return "2-8 Hours";
    case "Adventure":
      return "1-5 Hours";
    default:
      return "1-3 Hours";
  }
}

function inferTiming(category: AttractionCategory): string {
  switch (category) {
    case "Theme Park":
      return "10:00 AM - 8:00 PM (varies by venue)";
    case "Cruise & Tour":
      return "Multiple daily departures";
    case "Adventure":
      return "Morning and evening slots";
    default:
      return "Daily opening hours vary by attraction";
  }
}

function buildHighlights(category: AttractionCategory, country: AttractionCountrySource): string[] {
  switch (category) {
    case "Theme Park":
      return [
        "Entry to major rides and entertainment zones",
        "Best for families and first-time travelers",
        `Popular pick in ${country.name}`,
      ];
    case "Museum & Culture":
      return [
        "Heritage and cultural significance",
        "Great for guided city itineraries",
        "Photo-friendly iconic location",
      ];
    case "Nature & Wildlife":
      return [
        "Close-up nature and wildlife experiences",
        "Suitable for family and group travel",
        "Easy add-on with city sightseeing",
      ];
    case "Cruise & Tour":
      return [
        "Scenic city and coastal perspectives",
        "Flexible day and evening options",
        "Comfortable for couples and families",
      ];
    case "Adventure":
      return [
        "High-engagement experience with trained operators",
        "Safety-led operating procedures",
        "Ideal for thrill-seeking travelers",
      ];
    default:
      return [
        "Landmark experience in prime tourist area",
        "Fast booking and confirmed slots",
        "Suitable for all traveler types",
      ];
  }
}

function buildInclusions(category: AttractionCategory): string[] {
  const base = [
    "Standard admission as per selected option",
    "E-ticket or voucher delivery support",
    "Pre-travel coordination by Yono DMC team",
  ];

  if (category === "Cruise & Tour") {
    return [...base, "Shared transfer support on selected options"];
  }

  return base;
}

function buildExclusions(): string[] {
  return [
    "Personal expenses",
    "Meals unless mentioned",
    "Hotel pickup unless selected",
    "Travel insurance",
  ];
}

function buildCancellationPolicy(category: AttractionCategory): string {
  if (category === "Theme Park") {
    return "Theme park and date-based tickets are often non-refundable after issuance. Reschedule is subject to venue policy.";
  }
  if (category === "Adventure") {
    return "Free cancellation up to 48-72 hours before slot, depending on supplier and weather conditions.";
  }
  return "Free cancellation up to 24-48 hours before activity start time, subject to supplier terms.";
}

function buildMeetingPoint(country: AttractionCountrySource): string {
  return `${country.name} central pickup point or direct venue entry`;
}

function buildTicketsHref(title: string, country: AttractionCountrySource): string {
  const phone = siteConfig.contact.whatsapp.replace(/\D/g, "");
  const text = `Hi Yono DMC, I want tickets for ${title} in ${country.name}. Please share best available price and timing.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function buildAttraction(country: AttractionCountrySource, title: string, index: number): TicketedAttraction {
  const slug = `${country.key}-${slugify(title)}`;
  const category = inferCategory(title);
  const rating = Number((4.2 + (hashCode(`${country.key}-${title}`) % 80) / 100).toFixed(2));
  const reviews = 100 + (hashCode(`${title}-${country.key}-reviews`) % 25000);

  return {
    id: `${country.key}-${index + 1}`,
    slug,
    title,
    countryKey: country.key,
    countryName: country.name,
    tagline: country.tagline,
    cities: country.cities,
    location: country.name,
    image: `/api/images/${slug}`,
    rating,
    reviews,
    category,
    duration: inferDuration(category),
    timing: inferTiming(category),
    description: `${title} is a highly requested ticketed attraction in ${country.name}. Yono DMC helps you secure availability, pricing guidance, and a smooth booking process for this experience.`,
    highlights: buildHighlights(category, country),
    inclusions: buildInclusions(category),
    exclusions: buildExclusions(),
    cancellationPolicy: buildCancellationPolicy(category),
    meetingPoint: buildMeetingPoint(country),
    mapQuery: `${title}, ${country.name}`,
    detailsHref: `/things-to-do/${slug}`,
    ticketsHref: buildTicketsHref(title, country),
  };
}

export const ticketedAttractionCountries: AttractionCountry[] = ATTRACTION_COUNTRIES.map((country) => ({
  key: country.key,
  name: country.name,
  tagline: country.tagline,
  cities: country.cities,
}));

export const ticketedAttractions: TicketedAttraction[] = ATTRACTION_COUNTRIES.flatMap((country) =>
  country.items.map((title, index) => buildAttraction(country, title, index))
);

const attractionBySlug = new Map(ticketedAttractions.map((item) => [item.slug, item] as const));
const attractionByCountry = new Map(
  ticketedAttractionCountries.map((country) => [
    country.key,
    ticketedAttractions.filter((item) => item.countryKey === country.key),
  ] as const)
);

const countryByKey = new Map(ATTRACTION_COUNTRIES.map((country) => [country.key, country] as const));

const aliasIndex = ATTRACTION_COUNTRIES.flatMap((country) =>
  country.aliases.map((alias) => ({
    alias: normalize(alias),
    countryKey: country.key,
  }))
).sort((a, b) => b.alias.length - a.alias.length);

export function getTicketedAttractionBySlug(slug: string): TicketedAttraction | undefined {
  return attractionBySlug.get(slug);
}

export function getTicketedAttractionsByCountryKey(countryKey: string): TicketedAttraction[] {
  return attractionByCountry.get(countryKey) ?? [];
}

export function resolveAttractionCountry(destination: string): AttractionCountry | null {
  const normalizedDestination = normalize(destination);
  if (!normalizedDestination) return null;

  const matched = aliasIndex.find((entry) => normalizedDestination.includes(entry.alias));
  if (!matched) return null;

  const country = countryByKey.get(matched.countryKey);
  if (!country) return null;

  return {
    key: country.key,
    name: country.name,
    tagline: country.tagline,
    cities: country.cities,
  };
}

export function getTicketedAttractionsByDestination(destination: string): {
  country: AttractionCountry;
  items: TicketedAttraction[];
} | null {
  const country = resolveAttractionCountry(destination);
  if (!country) return null;

  const items = getTicketedAttractionsByCountryKey(country.key);
  return { country, items };
}
