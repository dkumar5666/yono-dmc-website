import crypto from "node:crypto";
import { getDb } from "@/lib/backend/sqlite";
import { travelTips } from "@/data/travelTips";

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

interface SqlBlogRow {
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

function ensureSeedData() {
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

function mapRow(row: SqlBlogRow) {
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

export function listBlogPosts() {
  ensureSeedData();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts
       ORDER BY publish_date DESC, updated_at DESC`
    )
    .all() as SqlBlogRow[];
  return rows.map(mapRow);
}

export function listPublishedBlogPosts() {
  ensureSeedData();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts
       WHERE status = 'published'
       ORDER BY publish_date DESC, updated_at DESC`
    )
    .all() as SqlBlogRow[];
  return rows.map(mapRow);
}

export function getPublishedBlogPostBySlug(slug: string) {
  ensureSeedData();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, slug, title, excerpt, content, publish_date, image_url, category, read_time, status, created_at, updated_at
       FROM blog_posts
       WHERE slug = ? AND status = 'published'`
    )
    .get(slug) as SqlBlogRow | undefined;
  return row ? mapRow(row) : null;
}

export function createBlogPost(input: BlogPostInput) {
  ensureSeedData();
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
    .get(id) as SqlBlogRow;
  return mapRow(created);
}

export function updateBlogPost(id: string, input: BlogPostInput) {
  ensureSeedData();
  const error = validateInput(input);
  if (error) throw new Error(error);
  const normalized = normalizeInput(input);
  const db = getDb();

  const existing = db.prepare("SELECT id FROM blog_posts WHERE id = ?").get(id) as { id: string } | undefined;
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
    .get(id) as SqlBlogRow;
  return mapRow(updated);
}

export function deleteBlogPost(id: string) {
  ensureSeedData();
  const db = getDb();
  const result = db.prepare("DELETE FROM blog_posts WHERE id = ?").run(id);
  if (!result.changes) throw new Error("Blog post not found");
}
