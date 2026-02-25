import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublishedBlogPostBySlug,
  listPublishedBlogPosts,
} from "@/lib/backend/blogAdmin";
import { holidays } from "@/data/holidays";
import HolidayCard from "@/components/HolidayCard";

type Params = { slug: string };

type BlogProfile = {
  focus: string;
  region: string;
  audience: string;
  themes: string[];
};

type BlogSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

const BLOG_PROFILES: Record<string, BlogProfile> = {
  "best-time-to-visit-japan": {
    focus: "Japan",
    region: "Tokyo, Kyoto, Osaka, and nearby regional circuits",
    audience: "first-time international and repeat seasonal travelers",
    themes: ["season", "rail planning", "city splits", "festivals"],
  },
  "dubai-first-timer-checklist": {
    focus: "Dubai",
    region: "Downtown, Marina, Palm, Deira, and day-trip extensions",
    audience: "first-time UAE travelers and short-break planners",
    themes: ["documents", "budget", "transport", "attractions"],
  },
  "bali-honeymoon-planning-guide": {
    focus: "Bali",
    region: "Seminyak, Ubud, Uluwatu, and Nusa Penida",
    audience: "honeymoon couples and premium leisure travelers",
    themes: ["villa planning", "romantic activities", "private transfers", "weather"],
  },
  "singapore-budget-itinerary-4-days": {
    focus: "Singapore",
    region: "Marina Bay, Sentosa, Chinatown, Bugis, and city MRT network",
    audience: "budget-conscious city travelers and families",
    themes: ["transport", "city routing", "ticket strategy", "daily budget"],
  },
  "malaysia-family-trip-guide": {
    focus: "Malaysia",
    region: "Kuala Lumpur, Genting Highlands, Penang, and Langkawi",
    audience: "family groups with children and multigenerational travelers",
    themes: ["comfort pacing", "family hotels", "intercity movement", "meal planning"],
  },
  "visa-documents-checklist": {
    focus: "Visa Application",
    region: "major outbound destinations from India",
    audience: "travelers and agents preparing embassy submissions",
    themes: ["documentation", "consistency", "financial proofs", "submission quality"],
  },
};

function buildSections(postTitle: string, profile: BlogProfile): BlogSection[] {
  const keywordLine = profile.themes.join(", ");

  return [
    {
      id: "overview",
      title: `Why ${profile.focus} Planning Needs a Structured Approach`,
      paragraphs: [
        `${postTitle} is not just about picking a destination and booking a random deal. For ${profile.audience}, the difference between an average trip and a smooth, memorable trip usually comes from structure. A strong plan starts by aligning travel goals, total budget, comfort preference, and available leave days. If those four factors are not mapped first, most itineraries become rushed, expensive, and inconsistent. This is where practical sequencing matters: flights first, then stay location, then ground movement, then activities. When planners skip sequencing, travelers often lose money on unnecessary transfers and last-minute upgrades. In destinations like ${profile.region}, travel time inside the city can decide how much you actually experience each day. Planning should therefore focus on realistic movement windows rather than only attraction count. A high-performing itinerary is one that protects energy, money, and time together.`,
        `From an SEO and travel advisory perspective, users searching for ${profile.focus} typically ask the same intent-based questions: best season, ideal stay area, visa or document readiness, and budget control. This guide addresses these intent clusters directly so you can decide faster and book with fewer revisions. We also recommend keeping one decision sheet that captures dates, expected per-day spend, and must-do experiences. That sheet becomes the reference point for every booking discussion, reducing confusion across multiple quotes. Whether you are planning independently or through Yono DMC, this process gives clarity and protects against avoidable travel friction.`,
      ],
    },
    {
      id: "season-and-timing",
      title: "Season, Timing, and Demand Windows",
      paragraphs: [
        `Seasonality is the largest pricing and experience variable for ${profile.focus}. Travelers who book without checking demand windows often pay peak rates for non-peak outcomes. Instead of asking only what the best month is, ask what the best month is for your specific intent: sightseeing, photography, honeymoon pace, family comfort, or shopping-led travel. A destination may be ideal for one intent and weak for another in the same week. For example, weather comfort, public crowd levels, and event calendars can shift the same itinerary quality significantly. The best practice is to shortlist two date ranges and compare hotel availability, flight pricing, and local event load before locking. This two-window comparison keeps flexibility while still enabling early booking advantages.`,
        `Another high-impact factor is arrival and departure timing. Landing late at night after long transit and then scheduling a full-day city plan next morning usually creates fatigue and low trip satisfaction. Keep day one as a controlled arrival block with light activity. If your destination has multiple zones, choose hotel location by first 48-hour plans, not by promotional photo appeal. In practical itinerary engineering, timing decisions should reduce unnecessary check-outs, cross-city transfers, and waiting time. This approach improves both trip experience and total value delivered per day.`,
      ],
    },
    {
      id: "budget-architecture",
      title: "Budget Architecture and Cost Control",
      paragraphs: [
        `Budget planning for ${profile.focus} should be built in layers, not a single lump sum. Separate fixed costs (flights, core hotel nights, visa, insurance) from flexible costs (activities, dining upgrades, shopping, local transport). This model prevents the common mistake where discretionary spend eats into essential trip coverage. Keep a minimum 10-15 percent contingency buffer for rate variation, schedule changes, or emergency upgrades. In most international trips, hidden leakage happens through poor zone selection, repeated transfers, and same-day ticketing at tourist counters. Pre-booking major attractions and transfer routes removes that leakage and gives a predictable daily spend range.`,
        `For travelers comparing multiple package quotes, always evaluate inclusions with operational detail: transfer type, activity slot category, tax coverage, cancellation conditions, and whether support is available during local disruptions. Two packages at similar headline prices can have very different total trip costs after these variables are applied. If a package does not clearly define what is excluded, treat it as a risk flag. A disciplined budget framework improves decision speed and increases confidence before payment release.`,
      ],
    },
    {
      id: "documents-and-compliance",
      title: "Documents, Compliance, and Risk Protection",
      paragraphs: [
        `Documentation quality is often the hidden reason behind delays, denied boarding stress, and last-minute panic. Even when destination entry appears simple, travelers should verify passport validity, name consistency across all bookings, and supporting records required by airline or local authority checks. For any trip touching visa workflows, document coherence is more important than document volume. Every name spelling, date, and financial reference should align across application forms and booking proofs. Inconsistency leads to additional scrutiny and processing delays. Keep digital backups and one printed travel set for immigration, hotel check-in, and emergency checks.`,
        `Travel insurance should not be treated as optional for long-haul, family, or high-value itinerary bookings. Basic medical and trip interruption coverage protects against scenarios that are financially larger than the policy premium. Similarly, payment trail and booking confirmation references should be centralized in one folder for easy retrieval. A clear compliance stack reduces operational friction and improves recovery speed if something changes mid-journey.`,
      ],
    },
    {
      id: "itinerary-design",
      title: "How to Design a High-Performance Itinerary",
      paragraphs: [
        `A high-performance itinerary balances experience density with physical comfort. The most common planning error is overloading day plans and underestimating movement time between zones. Build each day using one anchor activity, one secondary visit, and one flexible buffer block. This keeps quality high and allows adaptation for weather, crowd spikes, or delayed starts. If your trip includes multiple cities, minimize hotel switches unless each move provides clear experience gain. Frequent check-ins/check-outs often reduce actual sightseeing hours and increase fatigue.`,
        `Another proven method is thematic day grouping. For example, combine cultural spots in one sector, waterfront or skyline experiences in another, and shopping/food in a low-pressure block. This creates logical routing and reduces transport waste. Families should include recovery windows for children and seniors; couples should include privacy windows instead of only activity checklists. The goal is not maximum check-ins but maximum meaningful experiences per travel day.`,
      ],
    },
    {
      id: "common-mistakes",
      title: "Common Mistakes Travelers Make (and How to Avoid Them)",
      paragraphs: [
        `Mistake one is booking flights before validating stay zones and transfer costs. A cheap flight can become expensive if airport-to-hotel logistics are inefficient. Mistake two is choosing properties based only on star category rather than exact location utility. Mistake three is ignoring cancellation and amendment clauses in package components. Mistake four is missing documentation checks until close to departure. These four errors account for most avoidable trip escalations.`,
        `Avoiding these issues is straightforward: perform one pre-booking review covering ${keywordLine}. Ask your planner for a plain-language summary of inclusions and cut-off dates. Confirm what happens in case of weather or operational disruption. Keep all payment and itinerary versions organized by date. Small discipline before booking prevents major stress during travel.`,
      ],
    },
    {
      id: "packing-and-on-ground",
      title: "Packing, On-Ground Strategy, and Daily Execution",
      paragraphs: [
        `Packing should align with destination climate and itinerary rhythm, not generic travel lists. Build a core kit first: ID set, medicine essentials, charging adapters, payment backups, and weather-appropriate layers. Then add activity-specific items based on your confirmed plan. Overpacking slows check-in movement and increases transfer effort, especially in multi-stop trips. Keep one day-use pouch for travel documents, cards, and emergency contacts so essentials are always accessible.`,
        `On-ground execution improves when each day starts with a simple run sheet: departure time, key ticket references, transport mode, and fallback option. Travelers who follow a daily run sheet handle delays better and avoid decision fatigue. If you are using local SIM or eSIM, activate and test it before airport exit. For food and attraction queues, early slots usually provide better value and lower wait times. This disciplined approach converts a good itinerary into a reliably smooth trip.`,
      ],
    },
    {
      id: "final-checklist",
      title: "Final Action Checklist Before You Book",
      paragraphs: [
        `Before final confirmation, verify the following in one pass: traveler names, passport validity, flight timings, hotel zone logic, transfer type, activity slot category, cancellation policy, and payment milestones. If any of these remain unclear, request clarification before release of full payment. A booking should never proceed on assumption. Also confirm emergency support channel and response window in writing. This is especially important for family travel, honeymoon special requests, and peak-date departures.`,
        `If you want expert support, Yono DMC can convert this strategy into a destination-ready plan with practical day flow, service sequencing, and documentation guidance. The purpose of this long-form guide is to help you avoid avoidable mistakes and plan with confidence. Use the sections above as a live checklist while comparing options, and you will make stronger, safer booking decisions with better outcome per rupee spent.`,
      ],
    },
  ];
}

function countWords(sections: BlogSection[]): number {
  return sections
    .flatMap((section) => section.paragraphs)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export async function generateMetadata(
  { params }: { params: Promise<Params> | Params }
): Promise<Metadata> {
  const resolved = "then" in params ? await params : params;
  const post = await getPublishedBlogPostBySlug(resolved.slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: `${post.title} | Travel Tips & Guides`,
    description: post.excerpt,
  };
}

export async function generateStaticParams() {
  const posts = await listPublishedBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function TravelTipDetailPage(
  { params }: { params: Promise<Params> | Params }
) {
  const resolved = "then" in params ? await params : params;
  const post = await getPublishedBlogPostBySlug(resolved.slug);
  if (!post) notFound();

  const profile =
    BLOG_PROFILES[post.slug] ?? {
      focus: post.title,
      region: "major destination zones",
      audience: "international travelers",
      themes: ["planning", "budget", "documentation", "itinerary"],
    };

  const sections = buildSections(post.title, profile);
  const wordCount = countWords(sections);
  const estimatedReadTime = Math.max(6, Math.ceil(wordCount / 180));

  const keywordPool = [
    "japan",
    "dubai",
    "uae",
    "bali",
    "indonesia",
    "singapore",
    "malaysia",
    "vietnam",
    "thailand",
    "south korea",
    "korea",
    "india",
    "australia",
    "turkey",
    "mauritius",
    "honeymoon",
    "family",
  ];

  const postText = `${post.title} ${post.excerpt} ${post.category}`.toLowerCase();
  const matchedKeywords = keywordPool.filter((keyword) => postText.includes(keyword));

  const scored = holidays
    .map((holiday) => {
      const haystack = `${holiday.country} ${holiday.title} ${holiday.destinations.join(" ")}`.toLowerCase();
      const score = matchedKeywords.reduce(
        (sum, keyword) => (haystack.includes(keyword) ? sum + 1 : sum),
        0
      );
      return { holiday, score };
    })
    .sort((a, b) => b.score - a.score);

  const suggestedHolidays = scored
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => item.holiday);

  const finalSuggestions =
    suggestedHolidays.length > 0 ? suggestedHolidays : holidays.slice(0, 3);

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        <Link href="/travel-tips-guides" className="text-[#199ce0] font-semibold">
          &larr; Back to Travel Tips
        </Link>

        <article className="mt-6">
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-8">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover"

            />
          </div>
          <p className="text-sm text-blue-700 font-semibold mb-2">{post.category}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{post.title}</h1>
          <p className="text-sm text-gray-500 mb-8">
            {post.date} | {estimatedReadTime} min read | {wordCount.toLocaleString()} words
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-6">{post.excerpt}</p>

          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              {sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">{section.title}</h2>
                  <div className="space-y-4">
                    {section.paragraphs.map((paragraph, idx) => (
                      <p
                        key={`${section.id}-p-${idx}`}
                        className="text-gray-700 leading-relaxed"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-3">Table of Contents</h3>
                <ol className="space-y-2 text-sm">
                  {sections.map((section, index) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="text-slate-700 hover:text-[#199ce0]"
                      >
                        {index + 1}. {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </article>
      </div>

      <div className="mt-14">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Suggested Packages</h2>
            <p className="text-gray-600 mt-2">
              Handpicked package options related to this blog topic.
            </p>
          </div>
          <Link href="/holidays" className="font-semibold text-[#199ce0]">
            View All Packages &rarr;
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {finalSuggestions.map((item) => (
            <HolidayCard
              key={item.slug}
              title={item.title}
              description={item.description}
              slug={item.slug}
              duration={item.duration}
              priceFrom={item.priceFrom}
              image={item.image}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

