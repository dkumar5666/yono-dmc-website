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

async function fetchPexelsImage(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(
    query
  )}&orientation=landscape&per_page=1`;

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as PexelsResponse;
  const photo = data.photos?.[0]?.src;
  return photo?.landscape ?? photo?.large ?? photo?.large2x ?? photo?.original ?? null;
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
      "cache-control": "public, max-age=43200, s-maxage=43200",
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
