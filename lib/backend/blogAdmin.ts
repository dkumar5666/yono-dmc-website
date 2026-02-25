import crypto from "node:crypto";
import { getDb } from "@/lib/backend/sqlite";
import { travelTips } from "@/data/travelTips";
import {
  SupabaseNotConfiguredError,
  SupabaseRestClient,
  getSupabaseConfig,
} from "@/lib/core/supabase-rest";

const allowedStatuses = ["draft", "published", "archived"] as const;

export type BlogStatus = (typeof allowedStatuses)[number];

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publish_date: string;
  image_url: string;
  category: string;
  read_time: string;
  status: BlogStatus;
}

interface StoredBlogRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publish_date: string;
  image_url: string;
  category: string;
  read_time: string;
  status: BlogStatus;
  created_at: string;
  updated_at: string;
}

export interface BlogPostRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  image: string;
  category: string;
  readTime: string;
  status: BlogStatus;
  created_at: string;
  updated_at: string;
}

let supabaseSeedCompleted = false;
let supabaseSeedPromise: Promise<void> | null = null;

function sanitizeText(value: unknown, maxLen = 255): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeLongText(value: unknown, maxLen = 30000): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapRow(row: StoredBlogRow): BlogPostRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    date: row.publish_date,
    image: row.image_url,
    category: row.category,
    readTime: row.read_time,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeInput(input: BlogPostInput): BlogPostInput {
  return {
    title: sanitizeText(input.title, 180),
    slug: toSlug(sanitizeText(input.slug || input.title, 180)),
    excerpt: sanitizeLongText(input.excerpt, 1200),
    content: sanitizeLongText(input.content, 30000),
    publish_date: sanitizeText(input.publish_date, 10),
    image_url: sanitizeText(input.image_url, 500) || "/api/images/hero",
    category: sanitizeText(input.category, 80),
    read_time: sanitizeText(input.read_time, 40) || "6 min read",
    status: (input.status ?? "draft") as BlogStatus,
  };
}

function validateInput(input: BlogPostInput): string | null {
  if (!sanitizeText(input.title, 180)) return "title is required";
  if (!toSlug(input.slug || input.title)) return "slug is required";
  if (!sanitizeLongText(input.excerpt, 1200)) return "excerpt is required";
  if (!sanitizeLongText(input.content, 30000)) return "content is required";
  if (!isIsoDate(sanitizeText(input.publish_date, 10))) {
    return "publish_date must be YYYY-MM-DD";
  }
  if (!sanitizeText(input.image_url, 500)) return "image_url is required";
  if (!sanitizeText(input.category, 80)) return "category is required";
  if (!sanitizeText(input.read_time, 40)) return "read_time is required";
  if (!allowedStatuses.includes(input.status)) {
    return `status must be one of: ${allowedStatuses.join(", ")}`;
  }
  return null;
}

function blogSelectColumns(): string {
  return [
    "id",
    "slug",
    "title",
    "excerpt",
    "content",
    "publish_date",
    "image_url",
    "category",
    "read_time",
    "status",
    "created_at",
    "updated_at",
  ].join(",");
}

function recentOrderQuery(): URLSearchParams {
  const query = new URLSearchParams();
  query.set("select", blogSelectColumns());
  query.set("order", "publish_date.desc,updated_at.desc");
  return query;
}

function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseConfig());
}

function isDuplicateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("duplicate key value violates unique constraint") ||
    message.includes("\"23505\"") ||
    message.includes("23505")
  );
}

function isMissingBlogTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    (message.includes("blog_posts") && message.includes("does not exist")) ||
    message.includes("Could not find the table 'public.blog_posts'") ||
    message.includes("PGRST205")
  );
}

function toSupabaseSeedRow(post: (typeof travelTips)[number]): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    slug: sanitizeText(post.slug, 180),
    title: sanitizeText(post.title, 180),
    excerpt: sanitizeLongText(post.excerpt, 1200),
    content: sanitizeLongText(post.content, 30000),
    publish_date: sanitizeText(post.date, 10),
    image_url: sanitizeText(post.image, 500),
    category: sanitizeText(post.category, 80),
    read_time: sanitizeText(post.readTime, 40) || "6 min read",
    status: "published",
  };
}

async function ensureSupabaseSeedData(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (supabaseSeedCompleted) return;
  if (supabaseSeedPromise) return supabaseSeedPromise;

  supabaseSeedPromise = (async () => {
    const client = new SupabaseRestClient();
    try {
      const probe = new URLSearchParams();
      probe.set("select", "id");
      const existing = await client.selectSingle<{ id: string }>("blog_posts", probe);
      if (existing) {
        supabaseSeedCompleted = true;
        return;
      }
    } catch (error) {
      if (isMissingBlogTableError(error)) {
        throw new Error(
          "Supabase blog_posts table is missing. Run db/supabase/migrations/003_blog_posts.sql."
        );
      }
      throw error;
    }

    for (const post of travelTips) {
      try {
        await client.insertSingle<StoredBlogRow>("blog_posts", toSupabaseSeedRow(post));
      } catch (error) {
        if (isDuplicateError(error)) continue;
        throw error;
      }
    }

    supabaseSeedCompleted = true;
  })().finally(() => {
    supabaseSeedPromise = null;
  });

  return supabaseSeedPromise;
}

// SQLite fallback (local/dev or when Supabase is not configured)
function ensureSqliteSeedData() {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) as count FROM blog_posts").get() as { count: number };
  if (total.count > 0) return;

  const insert = db.prepare(
    `INSERT INTO blog_posts (
      id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db.exec("BEGIN");
  try {
    for (const post of travelTips) {
      insert.run(
        crypto.randomUUID(),
        sanitizeText(post.slug, 180),
        sanitizeText(post.title, 180),
        sanitizeLongText(post.excerpt, 1200),
        sanitizeLongText(post.content, 30000),
        sanitizeText(post.date, 10),
        sanitizeText(post.image, 500),
        sanitizeText(post.category, 80),
        sanitizeText(post.readTime, 40) || "6 min read",
        "published"
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function listBlogPostsSqlite(): BlogPostRecord[] {
  ensureSqliteSeedData();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts
       ORDER BY publish_date DESC, updated_at DESC`
    )
    .all() as StoredBlogRow[];
  return rows.map(mapRow);
}

function listPublishedBlogPostsSqlite(): BlogPostRecord[] {
  ensureSqliteSeedData();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts
       WHERE status = 'published'
       ORDER BY publish_date DESC, updated_at DESC`
    )
    .all() as StoredBlogRow[];
  return rows.map(mapRow);
}

function getPublishedBlogPostBySlugSqlite(slug: string): BlogPostRecord | null {
  ensureSqliteSeedData();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts
       WHERE slug = ? AND status = 'published'`
    )
    .get(slug) as StoredBlogRow | undefined;
  return row ? mapRow(row) : null;
}

function createBlogPostSqlite(input: BlogPostInput): BlogPostRecord {
  ensureSqliteSeedData();
  const error = validateInput(input);
  if (error) throw new Error(error);
  const normalized = normalizeInput(input);
  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO blog_posts (
      id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    normalized.slug,
    normalized.title,
    normalized.excerpt,
    normalized.content,
    normalized.publish_date,
    normalized.image_url,
    normalized.category,
    normalized.read_time,
    normalized.status
  );

  const created = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts WHERE id = ?`
    )
    .get(id) as StoredBlogRow;
  return mapRow(created);
}

function updateBlogPostSqlite(id: string, input: BlogPostInput): BlogPostRecord {
  ensureSqliteSeedData();
  const error = validateInput(input);
  if (error) throw new Error(error);
  const normalized = normalizeInput(input);
  const db = getDb();

  const existing = db.prepare("SELECT id FROM blog_posts WHERE id = ?").get(id) as
    | { id: string }
    | undefined;
  if (!existing) throw new Error("Blog post not found");

  db.prepare(
    `UPDATE blog_posts
     SET slug = ?, title = ?, excerpt = ?, content = ?, publish_date = ?, image_url = ?, category = ?, read_time = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    normalized.slug,
    normalized.title,
    normalized.excerpt,
    normalized.content,
    normalized.publish_date,
    normalized.image_url,
    normalized.category,
    normalized.read_time,
    normalized.status,
    id
  );

  const updated = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts WHERE id = ?`
    )
    .get(id) as StoredBlogRow;
  return mapRow(updated);
}

function deleteBlogPostSqlite(id: string): void {
  ensureSqliteSeedData();
  const db = getDb();
  const result = db.prepare("DELETE FROM blog_posts WHERE id = ?").run(id);
  if (!result.changes) throw new Error("Blog post not found");
}

function normalizeSupabaseError(error: unknown): never {
  if (error instanceof SupabaseNotConfiguredError) {
    throw error;
  }
  if (isDuplicateError(error)) {
    throw new Error("slug already exists");
  }
  throw error instanceof Error ? error : new Error(String(error));
}

export async function listBlogPosts(): Promise<BlogPostRecord[]> {
  if (!isSupabaseConfigured()) {
    return listBlogPostsSqlite();
  }

  try {
    await ensureSupabaseSeedData();
    const client = new SupabaseRestClient();
    const rows = await client.selectMany<StoredBlogRow>("blog_posts", recentOrderQuery());
    return rows.map(mapRow);
  } catch (error) {
    normalizeSupabaseError(error);
  }
}

export async function listPublishedBlogPosts(): Promise<BlogPostRecord[]> {
  if (!isSupabaseConfigured()) {
    return listPublishedBlogPostsSqlite();
  }

  try {
    await ensureSupabaseSeedData();
    const client = new SupabaseRestClient();
    const query = recentOrderQuery();
    query.set("status", "eq.published");
    const rows = await client.selectMany<StoredBlogRow>("blog_posts", query);
    return rows.map(mapRow);
  } catch (error) {
    normalizeSupabaseError(error);
  }
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostRecord | null> {
  if (!isSupabaseConfigured()) {
    return getPublishedBlogPostBySlugSqlite(slug);
  }

  try {
    await ensureSupabaseSeedData();
    const client = new SupabaseRestClient();
    const query = new URLSearchParams();
    query.set("select", blogSelectColumns());
    query.set("slug", `eq.${sanitizeText(slug, 180)}`);
    query.set("status", "eq.published");
    const row = await client.selectSingle<StoredBlogRow>("blog_posts", query);
    return row ? mapRow(row) : null;
  } catch (error) {
    normalizeSupabaseError(error);
  }
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogPostRecord> {
  if (!isSupabaseConfigured()) {
    return createBlogPostSqlite(input);
  }

  const error = validateInput(input);
  if (error) throw new Error(error);
  const normalized = normalizeInput(input);

  try {
    await ensureSupabaseSeedData();
    const client = new SupabaseRestClient();
    const row = await client.insertSingle<StoredBlogRow>("blog_posts", {
      id: crypto.randomUUID(),
      slug: normalized.slug,
      title: normalized.title,
      excerpt: normalized.excerpt,
      content: normalized.content,
      publish_date: normalized.publish_date,
      image_url: normalized.image_url,
      category: normalized.category,
      read_time: normalized.read_time,
      status: normalized.status,
    });
    return mapRow(row);
  } catch (e) {
    normalizeSupabaseError(e);
  }
}

export async function updateBlogPost(id: string, input: BlogPostInput): Promise<BlogPostRecord> {
  if (!isSupabaseConfigured()) {
    return updateBlogPostSqlite(id, input);
  }

  const error = validateInput(input);
  if (error) throw new Error(error);
  const normalized = normalizeInput(input);

  try {
    await ensureSupabaseSeedData();
    const client = new SupabaseRestClient();
    const query = new URLSearchParams();
    query.set("id", `eq.${id}`);
    const row = await client.updateSingle<StoredBlogRow>("blog_posts", query, {
      slug: normalized.slug,
      title: normalized.title,
      excerpt: normalized.excerpt,
      content: normalized.content,
      publish_date: normalized.publish_date,
      image_url: normalized.image_url,
      category: normalized.category,
      read_time: normalized.read_time,
      status: normalized.status,
    });
    if (!row) throw new Error("Blog post not found");
    return mapRow(row);
  } catch (e) {
    normalizeSupabaseError(e);
  }
}

export async function deleteBlogPost(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    deleteBlogPostSqlite(id);
    return;
  }

  try {
    await ensureSupabaseSeedData();
    const client = new SupabaseRestClient();
    const query = new URLSearchParams();
    query.set("id", `eq.${id}`);
    const row = await client.deleteSingle<{ id: string }>("blog_posts", query);
    if (!row) throw new Error("Blog post not found");
  } catch (e) {
    normalizeSupabaseError(e);
  }
}
