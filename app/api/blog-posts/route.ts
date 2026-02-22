import { NextResponse } from "next/server";
import { listPublishedBlogPosts } from "@/lib/backend/blogAdmin";

export async function GET() {
  try {
    return NextResponse.json({ data: listPublishedBlogPosts() });
  } catch (error) {
    console.error("PUBLIC BLOG POSTS ERROR:", error);
    return NextResponse.json({ error: "Failed to load blog posts" }, { status: 500 });
  }
}
