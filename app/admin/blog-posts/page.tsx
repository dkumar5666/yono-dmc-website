"use client";

import { FormEvent, useEffect, useState } from "react";

type BlogStatus = "draft" | "published" | "archived";

interface BlogPostRecord {
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
  updated_at: string;
}

interface BlogFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  date: string;
  image: string;
  category: string;
  readTime: string;
  status: BlogStatus;
}

const emptyForm: BlogFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  date: new Date().toISOString().slice(0, 10),
  image: "/api/images/hero",
  category: "Travel Tips",
  readTime: "8 min read",
  status: "draft",
};

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminBlogPostsPage() {
  const [list, setList] = useState<BlogPostRecord[]>([]);
  const [form, setForm] = useState<BlogFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        window.location.href = "/admin/login";
        return;
      }
      await loadPosts();
    })();
  }, []);

  async function loadPosts() {
    setError(null);
    const response = await fetch("/api/admin/blog-posts");
    const data = (await response.json()) as { data?: BlogPostRecord[]; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to load blog posts");
      return;
    }
    setList(data.data ?? []);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(item: BlogPostRecord) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt,
      content: item.content,
      date: item.date,
      image: item.image,
      category: item.category,
      readTime: item.readTime,
      status: item.status,
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || toSlug(form.title),
        excerpt: form.excerpt,
        content: form.content,
        publish_date: form.date,
        image_url: form.image,
        category: form.category,
        read_time: form.readTime,
        status: form.status,
      };

      const endpoint = editingId
        ? `/api/admin/blog-posts/${editingId}`
        : "/api/admin/blog-posts";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to save post");

      setMessage(editingId ? "Blog post updated." : "Blog post created.");
      resetForm();
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this blog post?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/blog-posts/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Delete failed");
      setMessage("Blog post deleted.");
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
      <section className="max-w-7xl mx-auto space-y-6">
        <form onSubmit={submitForm} className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit Blog Post" : "Add Blog Post"}
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Title *</span>
              <input
                required
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    title: e.target.value,
                    slug: prev.slug || toSlug(e.target.value),
                  }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Slug *</span>
              <input
                required
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: toSlug(e.target.value) }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Category *</span>
              <input
                required
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Publish Date *</span>
              <input
                required
                type="date"
                lang="en-GB"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Image URL *</span>
              <input
                required
                value={form.image}
                onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Read Time *</span>
              <input
                required
                value={form.readTime}
                onChange={(e) => setForm((prev) => ({ ...prev, readTime: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Status *</span>
              <select
                required
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.value as BlogStatus }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Excerpt *</span>
            <textarea
              required
              rows={3}
              value={form.excerpt}
              onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Content *</span>
            <textarea
              required
              rows={12}
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {busy ? "Saving..." : editingId ? "Update Blog Post" : "Create Blog Post"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="border rounded-lg px-4 py-2">
                Cancel
              </button>
            ) : null}
          </div>

          {message ? <p className="text-green-700 text-sm">{message}</p> : null}
          {error ? <p className="text-red-700 text-sm">{error}</p> : null}
        </form>

        <div className="bg-white rounded-xl shadow p-6 overflow-x-auto">
          <h2 className="text-xl font-semibold mb-4">Blog Posts</h2>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-3 font-medium">{item.title}</td>
                  <td className="py-3 pr-3">{item.slug}</td>
                  <td className="py-3 pr-3">{item.category}</td>
                  <td className="py-3 pr-3">{item.date}</td>
                  <td className="py-3 pr-3 capitalize">{item.status}</td>
                  <td className="py-3 pr-3">{item.updated_at}</td>
                  <td className="py-3 space-x-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="border rounded px-3 py-1"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(item.id)}
                      className="bg-red-600 text-white rounded px-3 py-1"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
  );
}
