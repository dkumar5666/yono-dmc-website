import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/backend/adminAuth";
import {
  createBlogPost,
  listBlogPosts,
  type BlogPostInput,
} from "@/lib/backend/blogAdmin";

export async function GET(req: Request) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    return NextResponse.json({ data: listBlogPosts() });
  } catch (error: unknown) {
    console.error("BLOG POSTS GET ERROR:", error);
    return NextResponse.json({ error: "Failed to load blog posts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const body = (await req.json()) as BlogPostInput;
    const created = createBlogPost(body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create blog post";
    const status = message.includes("required") || message.includes("must") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
