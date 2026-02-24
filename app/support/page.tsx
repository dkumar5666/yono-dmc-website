"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeHelp,
  ChevronRight,
  CircleDollarSign,
  Gift,
  Hotel,
  Lock,
  Plane,
  Shield,
  Sparkles,
  Ticket,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  UserCircle2,
  X,
} from "lucide-react";

interface CustomerMeResponse {
  data?: {
    user?: {
      name?: string | null;
    };
  };
}

interface HelpArticle {
  id: string;
  title: string;
  answer: string[];
  moreAboutLabel?: string;
}

interface HelpTopic {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  articles: HelpArticle[];
}

const helpTopics: HelpTopic[] = [
  {
    id: "flights",
    title: "Flights",
    icon: Plane,
    articles: [
      {
        id: "change-flight",
        title: "Change your flight",
        answer: [
          "Flight changes depend on airline fare rules and seat availability for your new timing.",
          "If your ticket allows change, support can process date/time updates after collecting fare difference and airline amendment fee.",
          "Keep your PNR, traveler names, and preferred new schedule ready for faster handling.",
        ],
        moreAboutLabel: "Trips",
      },
      {
        id: "cancel-flight",
        title: "Cancel your flight",
        answer: [
          "Cancellation charges are set by the airline and fare family. Some promotional fares are non-refundable.",
          "After cancellation, refundable amounts are returned to original source as per airline settlement timelines.",
          "Visit refund policy for slab-based rules where package cancellation is involved.",
        ],
        moreAboutLabel: "Refunds & Charges",
      },
      {
        id: "missed-flight",
        title: "Missed flight",
        answer: [
          "Contact airline support immediately to check no-show protection, standby options, or reissue possibilities.",
          "If you miss one sector in a round trip, the return may auto-cancel on some carriers. Request airline protection quickly.",
          "Share your itinerary number with support so we can guide next available option.",
        ],
      },
      {
        id: "baggage-rules",
        title: "Baggage restrictions",
        answer: [
          "Baggage allowance varies by airline, route, and cabin class.",
          "Always verify check-in and cabin baggage limits before airport arrival to avoid excess fees.",
          "Dangerous goods, oversized items, and batteries have special handling rules.",
        ],
      },
    ],
  },
  {
    id: "refunds",
    title: "Refunds & Charges",
    icon: CircleDollarSign,
    articles: [
      {
        id: "refund-timeline",
        title: "Refund process and timelines",
        answer: [
          "Refunds are processed once supplier confirms cancellation and final payable amount.",
          "For card/UPI, settlement usually reflects within banking cycle after processing.",
          "For B2B where applicable, credit note may be issued based on contract terms.",
        ],
      },
      {
        id: "service-fee",
        title: "Service and amendment fee",
        answer: [
          "Any post-booking change may include supplier charges plus service handling fee.",
          "Fees vary by booking type and urgency of request.",
          "Charges are always shared before payment collection for transparency.",
        ],
      },
      {
        id: "non-refundable",
        title: "Non-refundable bookings",
        answer: [
          "Certain promo fares and peak season inventory are marked non-refundable at booking level.",
          "These can still be reviewed for tax-only refund or date-change possibilities if supplier permits.",
          "Always review fare rules before final payment.",
        ],
      },
    ],
  },
  {
    id: "packages",
    title: "Packages",
    icon: Gift,
    articles: [
      {
        id: "inclusions",
        title: "What is included in package?",
        answer: [
          "Inclusions are listed in package details: hotels, transfers, sightseeing, meal plan, and guide language.",
          "Flights/visa/insurance may be optional based on chosen package tier.",
          "Final voucher includes day-wise reconfirmed services.",
        ],
      },
      {
        id: "customize-package",
        title: "Can I customize package?",
        answer: [
          "Yes. You can request changes in hotels, room category, trip pace, and activity list.",
          "Customized pricing is recalculated based on live inventory and season.",
          "Support team can prepare alternate versions for quick comparison.",
        ],
      },
      {
        id: "package-documents",
        title: "Package confirmation documents",
        answer: [
          "After full or milestone payment, you receive itinerary summary, vouchers, and payment receipt.",
          "For international packages, visa and insurance documents are shared separately when applicable.",
          "Keep a digital and printed copy during travel.",
        ],
      },
    ],
  },
  {
    id: "stays",
    title: "Stays",
    icon: Hotel,
    articles: [
      {
        id: "hotel-checkin",
        title: "Hotel check-in requirements",
        answer: [
          "Carry valid government photo ID/passport and booking voucher.",
          "Early check-in and late check-out are subject to availability and may attract extra charges.",
          "Security deposit policy depends on hotel and destination.",
        ],
      },
      {
        id: "room-change",
        title: "Room upgrade or change request",
        answer: [
          "Upgrade requests are handled based on inventory at time of check-in or pre-arrival confirmation.",
          "Rate difference applies for category upgrades.",
          "Please raise request at least 48 hours before check-in for better success rate.",
        ],
      },
      {
        id: "stay-cancel",
        title: "Cancel or modify stay booking",
        answer: [
          "Hotel policies differ by destination and rate plan.",
          "Some rates allow free cancellation until a cut-off, while others are non-refundable.",
          "Support can help evaluate best option before modification.",
        ],
      },
    ],
  },
  {
    id: "trips",
    title: "Trips",
    icon: Ticket,
    articles: [
      {
        id: "find-booking",
        title: "Find your booking",
        answer: [
          "Use Trips page with itinerary number and booking email if you are not signed in.",
          "Signed-in users can view all matched trips automatically.",
          "If not found, verify reference format and email spelling exactly as booking form.",
        ],
      },
      {
        id: "trip-status",
        title: "Understand trip status",
        answer: [
          "Draft: booking created; Pending payment: payment step started; Paid: payment captured; Confirmed: ticket/voucher issued.",
          "Failed or Cancelled status includes reason where available.",
          "Status updates are shown on Trips and sent through notifications.",
        ],
      },
      {
        id: "download-docs",
        title: "Download trip documents",
        answer: [
          "Trip vouchers and booking references are shared once confirmations are completed.",
          "Some suppliers send direct links; keep those emails safe.",
          "Contact support if you need a consolidated travel pack.",
        ],
      },
    ],
  },
  {
    id: "things-to-do",
    title: "Attractions",
    icon: Sparkles,
    articles: [
      {
        id: "activity-change",
        title: "Change activity date or slot",
        answer: [
          "Activity date changes depend on operator policy and slot availability.",
          "Peak-time attraction tickets often have strict change windows.",
          "Send your request early so we can attempt best alternatives.",
        ],
      },
      {
        id: "activity-meeting-point",
        title: "Meeting point and reporting time",
        answer: [
          "Each activity voucher includes exact pickup/meeting details.",
          "Arrive 15 to 20 minutes early for SIC tours and shared experiences.",
          "Missed reporting may be treated as no-show by operator.",
        ],
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    icon: UserCircle2,
    articles: [
      {
        id: "signin-options",
        title: "Sign in options",
        answer: [
          "You can sign in with Google or mobile OTP based on configured methods.",
          "Use the same mobile/email used during booking for best trip matching.",
          "Forgot password flow is available via OTP verification.",
        ],
      },
      {
        id: "profile-update",
        title: "Update profile details",
        answer: [
          "Basic profile updates can be requested via support until self-service profile page is expanded.",
          "For urgent booking corrections, contact support immediately.",
          "Name corrections may require supplier approval if ticket is issued.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    icon: Shield,
    articles: [
      {
        id: "data-usage",
        title: "How your data is used",
        answer: [
          "We use traveler data to process bookings, support travel operations, and send status updates.",
          "Payment processing is routed through secure providers.",
          "Read full policy for legal basis, retention, and rights.",
        ],
        moreAboutLabel: "Privacy Policy",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    icon: Lock,
    articles: [
      {
        id: "secure-booking",
        title: "How bookings are secured",
        answer: [
          "Session cookies, controlled API access, and provider-side payment security are applied.",
          "Never share OTP, password, or payment credentials on calls or social media.",
          "Report suspicious communication immediately.",
        ],
      },
    ],
  },
  {
    id: "travel-alerts",
    title: "Travel Alerts",
    icon: TriangleAlert,
    articles: [
      {
        id: "schedule-disruption",
        title: "Schedule disruption guidance",
        answer: [
          "In case of airline/hotel disruption, check your messages and Trips status first.",
          "If immediate action is needed, contact support with reference number.",
          "Our team will advise reroute/rebook/refund options based on supplier policy.",
        ],
      },
    ],
  },
];

export default function SupportPage() {
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [showGuestSigninCard, setShowGuestSigninCard] = useState(true);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as CustomerMeResponse;
        setCustomerName(data.data?.user?.name?.trim() || null);
      } catch {
        // ignore
      }
    })();
  }, []);

  const filteredTopics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return helpTopics;
    return helpTopics.filter(
      (item) =>
        item.title.toLowerCase().includes(normalized) ||
        item.articles.some((article) => article.title.toLowerCase().includes(normalized))
    );
  }, [query]);

  const activeTopic = useMemo(
    () => helpTopics.find((topic) => topic.id === activeTopicId) ?? null,
    [activeTopicId]
  );

  const activeArticle = useMemo(
    () => activeTopic?.articles.find((article) => article.id === activeArticleId) ?? null,
    [activeTopic, activeArticleId]
  );

  function openTopic(topicId: string) {
    setActiveTopicId(topicId);
    setActiveArticleId(null);
  }

  function closePanel() {
    setActiveTopicId(null);
    setActiveArticleId(null);
  }

  function runSearch() {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    const topicMatch = helpTopics.find(
      (topic) =>
        topic.title.toLowerCase().includes(normalized) ||
        topic.articles.some((article) => article.title.toLowerCase().includes(normalized))
    );
    if (!topicMatch) return;
    setActiveTopicId(topicMatch.id);
    const firstArticle = topicMatch.articles.find((article) =>
      article.title.toLowerCase().includes(normalized)
    );
    setActiveArticleId(firstArticle?.id ?? null);
  }

  return (
    <section className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-5xl font-bold text-slate-900">Help Centre</h1>
        <p className="mt-3 text-3xl font-semibold text-slate-900">
          Hi, {customerName ?? "Traveller"}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1">
            <BadgeHelp className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
              placeholder="How can we help?"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
          <button
            type="button"
            onClick={runSearch}
            className="rounded-full bg-[#199ce0] px-8 py-3 font-semibold text-white hover:opacity-90"
          >
            Search
          </button>
        </div>

        {!customerName && showGuestSigninCard && (
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
                <Lock className="h-11 w-11 text-[#199ce0]" />
              </div>
              <p className="mt-5 text-slate-900 font-medium">Sign in for customized help</p>
              <Link
                href="/login?next=%2Fsupport"
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#199ce0] px-5 py-2.5 font-semibold text-white"
              >
                Sign in
              </Link>
              <button
                type="button"
                onClick={() => setShowGuestSigninCard(false)}
                className="mt-3 text-[#199ce0]"
              >
                Not right now
              </button>
            </div>
          </div>
        )}

        <div className="mt-14">
          <h2 className="text-4xl font-bold text-slate-900">Explore help articles</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredTopics.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => openTopic(item.id)}
                  className="flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3 transition hover:border-[#199ce0] hover:shadow-sm"
                >
                  <span className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Icon className="h-5 w-5 text-[#199ce0]" />
                    {item.title}
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                </button>
              );
            })}
          </div>
          {filteredTopics.length === 0 && (
            <p className="mt-4 text-slate-600">No matching help topics found.</p>
          )}
        </div>
      </div>

      {activeTopic && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close help panel overlay"
            onClick={closePanel}
            className="absolute inset-0 bg-slate-900/35"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 border-b bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-slate-900">
                <button
                  type="button"
                  onClick={closePanel}
                  className="inline-flex items-center justify-center rounded-md p-1 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
                <p className="text-2xl font-semibold">{activeTopic.title}</p>
              </div>
            </div>

            {!activeArticle ? (
              <div className="px-4 py-4">
                <ul className="space-y-1">
                  {activeTopic.articles.map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => setActiveArticleId(article.id)}
                        className="w-full rounded-lg px-2 py-2 text-left text-[#199ce0] hover:bg-slate-50 flex items-center justify-between"
                      >
                        <span>{article.title}</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="px-6 py-5">
                <button
                  type="button"
                  onClick={() => setActiveArticleId(null)}
                  className="inline-flex items-center gap-2 text-[#199ce0] font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {activeTopic.title}
                </button>

                <div className="mt-4 border-b pb-3 text-sm text-slate-600">
                  <span className="text-[#199ce0]">{activeTopic.title}</span>
                  <span className="mx-2">›</span>
                  <span>{activeArticle.title}</span>
                </div>

                <h3 className="mt-4 text-5xl font-bold text-slate-900">{activeArticle.title}</h3>
                <div className="mt-4 space-y-3 text-slate-700 leading-relaxed">
                  {activeArticle.answer.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>

                {activeArticle.moreAboutLabel && (
                  <div className="mt-5 border-t pt-3 text-slate-700">
                    <p>
                      More about:{" "}
                      <span className="inline-flex items-center gap-1 text-[#199ce0] font-medium">
                        {activeArticle.moreAboutLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </p>
                  </div>
                )}

                <div className="mt-6 border-t pt-4">
                  <p className="text-2xl font-semibold text-slate-900">Was this topic helpful?</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50"
                    >
                      <ThumbsUp className="h-4 w-4 text-slate-700" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50"
                    >
                      <ThumbsDown className="h-4 w-4 text-slate-700" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
