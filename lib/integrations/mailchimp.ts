import "server-only";

import crypto from "node:crypto";

export interface IntegrationCallResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

interface MailchimpConfig {
  apiKey: string;
  serverPrefix: string;
  audienceId: string;
}

interface UpsertContactInput {
  email: string;
  phone?: string | null;
  name?: string | null;
  tags?: string[];
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getConfig(): MailchimpConfig | null {
  const apiKey = safeString(process.env.MAILCHIMP_API_KEY);
  const serverPrefix = safeString(process.env.MAILCHIMP_SERVER_PREFIX);
  const audienceId = safeString(process.env.MAILCHIMP_AUDIENCE_ID);

  if (!apiKey || !serverPrefix || !audienceId) return null;
  return { apiKey, serverPrefix, audienceId };
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => safeString(tag))
        .filter(Boolean)
    )
  );
}

function splitName(name: string): { firstName: string; lastName: string } {
  const cleaned = safeString(name);
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function upsertContact(input: UpsertContactInput): Promise<IntegrationCallResult> {
  const config = getConfig();
  if (!config) return { ok: false, skipped: true, error: "missing_config" };

  const email = safeString(input.email).toLowerCase();
  if (!email) return { ok: false, skipped: true, error: "missing_email" };

  const normalizedTags = normalizeTags(input.tags);
  const subscriberHash = crypto.createHash("md5").update(email).digest("hex");
  const baseUrl = `https://${config.serverPrefix}.api.mailchimp.com/3.0`;
  const memberUrl = `${baseUrl}/lists/${config.audienceId}/members/${subscriberHash}`;
  const authHeader = `Basic ${Buffer.from(`anystring:${config.apiKey}`).toString("base64")}`;
  const { firstName, lastName } = splitName(safeString(input.name));

  try {
    const upsertResponse = await fetchWithTimeout(
      memberUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          email_address: email,
          status_if_new: "subscribed",
          merge_fields: {
            FNAME: firstName || undefined,
            LNAME: lastName || undefined,
            PHONE: safeString(input.phone) || undefined,
          },
        }),
      },
      8000
    );
    const upsertText = await upsertResponse.text().catch(() => "");
    const upsertData = safeJsonParse(upsertText);

    if (!upsertResponse.ok) {
      return {
        ok: false,
        status: upsertResponse.status,
        data: upsertData,
        error: "upsert_failed",
      };
    }

    if (normalizedTags.length > 0) {
      const tagResponse = await fetchWithTimeout(
        `${memberUrl}/tags`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            tags: normalizedTags.map((tag) => ({ name: tag, status: "active" })),
          }),
        },
        8000
      );
      const tagText = await tagResponse.text().catch(() => "");
      const tagData = safeJsonParse(tagText);

      if (!tagResponse.ok) {
        return {
          ok: false,
          status: tagResponse.status,
          data: tagData,
          error: "tagging_failed",
        };
      }
    }

    return {
      ok: true,
      status: 200,
      data: { email, tags: normalizedTags },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "mailchimp_request_failed",
    };
  }
}
