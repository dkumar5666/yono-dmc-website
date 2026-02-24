import { NextResponse } from "next/server";
import { imageCatalog, isImageKey } from "@/lib/imageCatalog";

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";

type PexelsResponse = {
  photos?: Array<{
    src?: {
      large2x?: string;
      large?: string;
      landscape?: string;
      original?: string;
    };
  }>;
};

const resolvedImageUrlCache = new Map<string, string>();

async function fetchPexelsImage(query: string): Promise<string | null> {
  const cached = resolvedImageUrlCache.get(query);
  if (cached) return cached;

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(
    query
  )}&orientation=landscape&size=large&per_page=3`;

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as PexelsResponse;
  const photo = data.photos?.[0]?.src;
  // Prefer balanced quality to keep pages fast and still crisp.
  const resolved = photo?.large2x ?? photo?.large ?? photo?.landscape ?? photo?.original ?? null;
  if (resolved) {
    resolvedImageUrlCache.set(query, resolved);
  }
  return resolved;
}

async function fetchImageBinary(url: string): Promise<Response | null> {
  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;

  const bytes = await response.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> | { key: string } }
) {
  const params = "then" in context.params ? await context.params : context.params;
  const key = params.key.toLowerCase();

  const fallbackEntry = imageCatalog.hero;
  const entry = isImageKey(key)
    ? imageCatalog[key]
    : {
        query: `${key.replace(/-/g, " ")} travel destination`,
        fallback: fallbackEntry.fallback,
      };

  const pexelsUrl = await fetchPexelsImage(entry.query);
  const destinationUrl = pexelsUrl ?? entry.fallback ?? fallbackEntry.fallback;

  const directImage = await fetchImageBinary(destinationUrl);
  if (directImage) return directImage;

  const fallbackImage = await fetchImageBinary(fallbackEntry.fallback);
  if (fallbackImage) return fallbackImage;

  return NextResponse.json({ error: "Unable to load image" }, { status: 502 });
}
