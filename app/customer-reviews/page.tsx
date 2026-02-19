import type { Metadata } from "next";
import { testimonials } from "@/data/mockData";

export const metadata: Metadata = {
  title: "Customer Reviews",
  description:
    "Read verified customer experiences and travel feedback for Yono DMC holiday packages.",
};

export default function CustomerReviewsPage() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Customer Reviews</h1>
        <p className="text-gray-600">
          Real feedback from travelers who booked with Yono DMC.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testimonials.map((review) => (
          <article
            key={review.id}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-slate-900">{review.name}</h2>
              <span className="text-sm text-amber-600 font-semibold">
                {"★".repeat(review.rating)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-4">{review.location}</p>
            <p className="text-gray-700 leading-relaxed">&ldquo;{review.comment}&rdquo;</p>
          </article>
        ))}
      </div>
    </section>
  );
}

