import { NextResponse } from "next/server";
import { listPublishedBlogPosts } from "@/lib/backend/blogAdmin";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";

export async function GET(req: Request) {
  const rateLimitResponse = enforceRateLimit(req, {
    key: "public:blog-posts",
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    return NextResponse.json({ data: await listPublishedBlogPosts() });
  } catch (error) {
    console.error("PUBLIC BLOG POSTS ERROR:", error);
    return NextResponse.json({ error: "Failed to load blog posts" }, { status: 500 });
  }
}
