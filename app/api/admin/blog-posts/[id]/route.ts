import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  deleteBlogPost,
  updateBlogPost,
  type BlogPostInput,
} from "@/lib/backend/blogAdmin";

type Params = { id: string };

export async function PUT(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const resolved = "then" in params ? await params : params;
    const body = (await req.json()) as BlogPostInput;
    const updated = await updateBlogPost(resolved.id, body);
    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update blog post";
    const status =
      message.includes("required") ||
      message.includes("must") ||
      message.includes("not found")
        ? 400
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> | Params }
) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const resolved = "then" in params ? await params : params;
    await deleteBlogPost(resolved.id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete blog post";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

