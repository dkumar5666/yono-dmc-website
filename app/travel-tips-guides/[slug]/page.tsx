import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { travelTips } from "@/data/travelTips";

type Params = { slug: string };

export async function generateMetadata(
  { params }: { params: Promise<Params> | Params }
): Promise<Metadata> {
  const resolved = "then" in params ? await params : params;
  const post = travelTips.find((item) => item.slug === resolved.slug);
  if (!post) return { title: "Post Not Found" };
  return {
    title: `${post.title} | Travel Tips & Guides`,
    description: post.excerpt,
  };
}

export default async function TravelTipDetailPage(
  { params }: { params: Promise<Params> | Params }
) {
  const resolved = "then" in params ? await params : params;
  const post = travelTips.find((item) => item.slug === resolved.slug);
  if (!post) notFound();

  return (
    <section className="max-w-4xl mx-auto px-4 py-16">
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
            unoptimized={post.image.startsWith("/api/images/")}
          />
        </div>
        <p className="text-sm text-blue-700 font-semibold mb-2">{post.category}</p>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{post.title}</h1>
        <p className="text-sm text-gray-500 mb-8">{post.date} · {post.readTime}</p>
        <p className="text-lg text-gray-700 leading-relaxed mb-6">{post.excerpt}</p>
        <p className="text-gray-700 leading-relaxed">
          This guide is part of our travel knowledge hub. For personalized itinerary planning,
          hotel recommendations, visa support, and complete package customization, contact the Yono
          DMC team from the home page enquiry form or WhatsApp button.
        </p>
      </article>
    </section>
  );
}

