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
  return photo?.large2x ?? photo?.large ?? photo?.landscape ?? photo?.original ?? null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> | { key: string } }
) {
  const params = "then" in context.params ? await context.params : context.params;
  const key = params.key;

  if (!isImageKey(key)) {
    return NextResponse.json({ error: "Image key not found" }, { status: 404 });
  }

  const entry = imageCatalog[key];
  const pexelsUrl = await fetchPexelsImage(entry.query);
  const destinationUrl = pexelsUrl ?? entry.fallback;

  return NextResponse.redirect(destinationUrl, 307);
}
