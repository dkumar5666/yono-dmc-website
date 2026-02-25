import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listPublishedBlogPosts } from "@/lib/backend/blogAdmin";

export const metadata: Metadata = {
  title: "Travel Tips & Guides",
  description:
    "Discover practical travel tips, destination guides, and expert planning advice for your next holiday.",
};

export default async function TravelTipsGuidesPage() {
  const posts = await listPublishedBlogPosts();

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Travel Tips & Guides</h1>
        <p className="text-gray-600">
          Discover travel tips, destination guides, and stories to make your journeys unforgettable.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((item) => (
          <Link key={item.slug} href={`/travel-tips-guides/${item.slug}`} className="block">
            <article className="h-full bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-52">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover"

                />
              </div>
              <div className="p-5">
                <p className="text-sm text-blue-700 font-semibold mb-2">{item.category}</p>
                <h2 className="text-2xl md:text-xl font-semibold text-slate-900 mb-2">{item.title}</h2>
                <p className="text-gray-600 mb-4">{item.excerpt}</p>
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <span>{item.date}</span>
                  <span>{item.readTime}</span>
                </div>
                <span className="font-semibold text-[#199ce0]">
                  View Post &rarr;
                </span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}

