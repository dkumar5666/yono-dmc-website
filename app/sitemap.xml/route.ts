import { NextResponse } from "next/server";
import { holidays } from "@/data/holidays";
import { travelTips } from "@/data/travelTips";
import { destinations } from "@/data/mockData";

function baseUrl(): string {
  const value = process.env.SITE_URL?.trim() || "https://www.yonodmc.in";
  try {
    return new URL(value).origin;
  } catch {
    return "https://www.yonodmc.in";
  }
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const root = baseUrl();
  const now = new Date().toISOString();

  const staticPaths = [
    "/",
    "/login",
    "/plan-my-trip",
    "/holidays",
    "/destinations",
    "/offers",
    "/things-to-do",
    "/travel-tips-guides",
    "/support",
    "/about",
    "/contact",
  ];

  const destinationPaths = Array.from(
    new Set(
      destinations.map((row) => {
        const country = (row.country || row.name || "").trim();
        return country ? `/destinations/${toSlug(country)}` : "";
      })
    )
  ).filter(Boolean);

  const holidayPaths = holidays.map((row) => `/holidays/${row.slug}`);
  const tipPaths = travelTips.map((row) => `/travel-tips-guides/${row.slug}`);

  const allPaths = Array.from(new Set([...staticPaths, ...destinationPaths, ...holidayPaths, ...tipPaths]));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths
  .map(
    (path) => `<url>
  <loc>${root}${path}</loc>
  <lastmod>${now}</lastmod>
  <changefreq>${path === "/" ? "daily" : "weekly"}</changefreq>
  <priority>${path === "/" ? "1.0" : "0.7"}</priority>
</url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
