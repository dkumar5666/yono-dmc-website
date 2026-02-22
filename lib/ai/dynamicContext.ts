import { getCatalog } from "@/lib/backend/catalogStore";
import { listPublishedBlogPosts } from "@/lib/backend/blogAdmin";
import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import { getCustomerById } from "@/lib/backend/customerStore";
import { listBookings } from "@/lib/backend/store";

function normalizeText(input: string): string {
  return input.toLowerCase().trim();
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function scoreByTokens(text: string, tokens: string[]): number {
  const haystack = normalizeText(text);
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function normalizePhone(input: string | null | undefined): string {
  return (input ?? "").replace(/\D/g, "");
}

function normalizeEmail(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

async function buildCatalogContext(query: string): Promise<string> {
  try {
    const { destinations, packages } = await getCatalog();
    const tokens = tokenize(query);

    const topDestinations = destinations
      .map((item) => {
        const text = `${item.name} ${item.country ?? ""} ${item.tagline} ${
          Array.isArray(item.cities) ? item.cities.join(" ") : ""
        }`;
        const score = tokens.length > 0 ? scoreByTokens(text, tokens) : 1;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(
        ({ item }) =>
          `- ${item.name}: ${item.tagline}. Cities: ${
            item.cities?.join(", ") || "N/A"
          }. Link: /destinations/${item.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")}`
      );

    const topPackages = packages
      .map((item) => {
        const text = `${item.title} ${item.destination} ${item.duration} ${item.inclusions.join(
          " "
        )}`;
        const score = tokens.length > 0 ? scoreByTokens(text, tokens) : 1;
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(
        ({ item }) =>
          `- ${item.title} (${item.destination}) ${item.duration}, ${item.price} ${"INR"} approx. Link: /holidays/${item.slug}`
      );

    return [
      "Live Catalog Context:",
      topDestinations.length > 0
        ? `Top matching destinations:\n${topDestinations.join("\n")}`
        : "Top matching destinations: none",
      topPackages.length > 0
        ? `Top matching packages:\n${topPackages.join("\n")}`
        : "Top matching packages: none",
    ].join("\n");
  } catch {
    return "Live Catalog Context: unavailable";
  }
}

function buildBlogContext(query: string): string {
  try {
    const posts = listPublishedBlogPosts();
    const tokens = tokenize(query);
    const topPosts = posts
      .map((post) => {
        const text = `${post.title} ${post.excerpt} ${post.category}`;
        const score = tokens.length > 0 ? scoreByTokens(text, tokens) : 1;
        return { post, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(
        ({ post }) =>
          `- ${post.title} (${post.category}). Link: /travel-tips-guides/${post.slug}`
      );

    if (topPosts.length === 0) {
      return "Blog Context: no matching blog posts found.";
    }
    return `Blog Context (matching posts):\n${topPosts.join("\n")}`;
  } catch {
    return "Blog Context: unavailable";
  }
}

async function buildCustomerTripContext(req: Request): Promise<string> {
  try {
    const session = getCustomerSessionFromRequest(req);
    if (!session) return "Customer Context: guest user.";

    const customer = getCustomerById(session.id);
    if (!customer) return "Customer Context: guest user.";

    const customerEmail = normalizeEmail(customer.email);
    const customerPhone = normalizePhone(customer.phone);

    const bookings = await listBookings();
    const matched = bookings
      .filter((item) => {
        const bookingEmail = normalizeEmail(item.contact.email);
        const bookingPhone = normalizePhone(item.contact.phone);
        const emailMatch =
          customerEmail.length > 0 &&
          bookingEmail.length > 0 &&
          customerEmail === bookingEmail;
        const phoneMatch =
          customerPhone.length > 0 &&
          bookingPhone.length > 0 &&
          customerPhone === bookingPhone;
        return emailMatch || phoneMatch;
      })
      .slice(0, 5)
      .map(
        (item) =>
          `- ${item.reference}: ${item.status}, ${item.currency} ${item.amount.toLocaleString(
            "en-IN"
          )}, created ${item.createdAt.slice(0, 10)}`
      );

    return [
      `Customer Context: logged in as ${customer.fullName}.`,
      matched.length > 0
        ? `Recent matched trips:\n${matched.join("\n")}`
        : "Recent matched trips: none",
    ].join("\n");
  } catch {
    return "Customer Context: unavailable";
  }
}

export async function buildDynamicAIContext(
  req: Request,
  query: string
): Promise<string> {
  const [catalogContext, customerContext] = await Promise.all([
    buildCatalogContext(query),
    buildCustomerTripContext(req),
  ]);
  const blogContext = buildBlogContext(query);

  return [catalogContext, blogContext, customerContext].join("\n\n");
}

