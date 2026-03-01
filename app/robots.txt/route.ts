import { NextResponse } from "next/server";

function baseUrl(): string {
  const value = process.env.SITE_URL?.trim() || "https://www.yonodmc.in";
  try {
    return new URL(value).origin;
  } catch {
    return "https://www.yonodmc.in";
  }
}

export async function GET() {
  const root = baseUrl();
  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${root}/sitemap.xml
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
