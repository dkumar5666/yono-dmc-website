import "server-only";

/**
 * SECURITY RULE:
 * - This file must stay server-only.
 * - SUPABASE_SERVICE_ROLE_KEY must never be sent to client components/browser bundles.
 * - Use this client only in trusted server code (API routes, server actions, cron workers).
 */
interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    this.name = "SupabaseNotConfiguredError";
  }
}

export class SupabaseRestClient {
  private readonly config: SupabaseConfig;

  constructor(config?: SupabaseConfig) {
    const resolved = config ?? getSupabaseConfig();
    if (!resolved) throw new SupabaseNotConfiguredError();
    this.config = resolved;
  }

  async selectSingle<T>(table: string, query: URLSearchParams): Promise<T | null> {
    query.set("limit", "1");
    const rows = await this.selectMany<T>(table, query);
    return rows[0] ?? null;
  }

  async selectMany<T>(table: string, query: URLSearchParams): Promise<T[]> {
    const url = `${this.config.url}/rest/v1/${table}?${query.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers(),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Supabase select failed (${table}): ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as T[] | null;
    return Array.isArray(payload) ? payload : [];
  }

  async insertSingle<T>(table: string, payload: Record<string, unknown>): Promise<T> {
    const url = `${this.config.url}/rest/v1/${table}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...this.headers(),
        Prefer: "return=representation",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Supabase insert failed (${table}): ${response.status} ${await response.text()}`);
    }

    const rows = (await response.json()) as T[];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`Supabase insert returned empty payload (${table}).`);
    }
    return rows[0];
  }

  async updateSingle<T>(
    table: string,
    query: URLSearchParams,
    payload: Record<string, unknown>
  ): Promise<T | null> {
    const url = `${this.config.url}/rest/v1/${table}?${query.toString()}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        ...this.headers(),
        Prefer: "return=representation",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Supabase update failed (${table}): ${response.status} ${await response.text()}`);
    }

    const rows = (await response.json()) as T[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async deleteSingle<T>(table: string, query: URLSearchParams): Promise<T | null> {
    const url = `${this.config.url}/rest/v1/${table}?${query.toString()}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...this.headers(),
        Prefer: "return=representation",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Supabase delete failed (${table}): ${response.status} ${await response.text()}`);
    }

    const rows = (await response.json()) as T[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async uploadFile(
    bucket: string,
    objectPath: string,
    content: string | Uint8Array,
    contentType: string
  ): Promise<{ path: string; bucket: string }> {
    const normalizedPath = objectPath.replace(/^\/+/, "");
    const url = `${this.config.url}/storage/v1/object/${bucket}/${normalizedPath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: this.config.serviceRoleKey,
        Authorization: `Bearer ${this.config.serviceRoleKey}`,
        "x-upsert": "true",
        "Content-Type": contentType,
      },
      body: typeof content === "string" ? content : Buffer.from(content),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Supabase storage upload failed (${bucket}/${normalizedPath}): ${response.status} ${await response.text()}`
      );
    }

    return { path: normalizedPath, bucket };
  }

  publicUrl(bucket: string, objectPath: string): string {
    const normalizedPath = objectPath.replace(/^\/+/, "");
    return `${this.config.url}/storage/v1/object/public/${bucket}/${normalizedPath}`;
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.config.serviceRoleKey,
      Authorization: `Bearer ${this.config.serviceRoleKey}`,
    };
  }
}
