import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MessageSquareQuote, Star } from "lucide-react";
import { testimonials } from "@/data/mockData";

export const metadata: Metadata = {
  title: "Customer Reviews",
  description:
    "Read verified customer experiences and travel feedback for Yono DMC holidays.",
};

export default function CustomerReviewsPage() {
  const totalReviews = testimonials.length;
  const avgRating = (
    testimonials.reduce((sum, item) => sum + item.rating, 0) /
    Math.max(totalReviews, 1)
  ).toFixed(1);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-[#199ce0] via-[#178fcc] to-[#0f6f9f] text-white py-14 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-1 text-sm font-medium mb-4">
                <MessageSquareQuote className="h-4 w-4" />
                Real Traveler Feedback
              </p>
              <h1 className="text-4xl md:text-5xl font-bold mb-3">
                Customer Reviews
              </h1>
              <p className="text-white/90 text-lg">
                Verified experiences from travelers who booked holidays with
                Yono DMC.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur p-5">
                <p className="text-sm text-white/85">Average Rating</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-4xl font-bold">{avgRating}</p>
                  <p className="text-white/85 mb-1">/ 5</p>
                </div>
                <div className="mt-2 flex items-center gap-1 text-amber-300">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur p-5">
                <p className="text-sm text-white/85">Verified Reviews</p>
                <p className="mt-2 text-4xl font-bold">{totalReviews}+</p>
                <p className="mt-2 text-white/85 text-sm">
                  More traveler stories added regularly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-10 md:py-12">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {testimonials.map((review) => (
            <article
              key={review.id}
              className="group bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="relative h-14 w-14 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  <Image
                    src={review.image}
                    alt={review.name}
                    fill
                    className="object-cover"

                    sizes="56px"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {review.name}
                  </h2>
                  <p className="text-sm text-slate-500">{review.location}</p>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-1 text-amber-500">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
                <span className="ml-2 text-xs font-semibold text-slate-500">
                  {review.rating}.0 / 5
                </span>
              </div>

              <p className="text-slate-700 leading-relaxed">
                &ldquo;{review.comment}&rdquo;
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-14">
        <div className="rounded-3xl bg-gradient-to-r from-[#199ce0] to-[#127db4] text-white p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <h2 className="text-3xl font-bold">Plan Your Trip with Confidence</h2>
              <p className="mt-2 text-white/90">
                Speak with our experts for destination planning, visa support,
                and best available package options.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://wa.me/919958839319"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-[#f5991c] px-6 py-3 font-semibold text-white hover:opacity-90"
              >
                Talk on WhatsApp
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 font-semibold text-[#199ce0] hover:bg-slate-100"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

