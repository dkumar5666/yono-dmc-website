import "server-only";

interface SendWhatsAppTemplateInput {
  to: string;
  template: string;
  variables?: Record<string, string | number | null | undefined>;
}

export interface IntegrationCallResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  data?: unknown;
  error?: string;
}

interface AisensyConfig {
  apiKey: string;
  baseUrl: string;
  senderId: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getConfig(): AisensyConfig | null {
  const apiKey = safeString(process.env.AISENSY_API_KEY);
  if (!apiKey) return null;

  const baseUrl = safeString(process.env.AISENSY_BASE_URL) || "https://backend.aisensy.com";
  const senderId = safeString(process.env.AISENSY_SENDER_ID);
  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    senderId,
  };
}

function normalizeTemplateVariables(
  variables: Record<string, string | number | null | undefined> | undefined
): Record<string, string> {
  if (!variables) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (value === null || value === undefined) continue;
    const val = safeString(String(value));
    if (val) out[key] = val;
  }
  return out;
}

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWhatsAppTemplate(
  input: SendWhatsAppTemplateInput
): Promise<IntegrationCallResult> {
  const config = getConfig();
  if (!config) {
    return {
      ok: false,
      skipped: true,
      error: "missing_config",
    };
  }

  const to = safeString(input.to);
  const template = safeString(input.template);
  if (!to || !template) {
    return {
      ok: false,
      skipped: true,
      error: "invalid_input",
    };
  }

  const variables = normalizeTemplateVariables(input.variables);
  const payload: Record<string, unknown> = {
    destination: to,
    templateName: template,
    campaignName: template,
    params: variables,
    userName: variables.name || to,
  };
  if (config.senderId) {
    payload.sender = config.senderId;
    payload.senderId = config.senderId;
  }

  const endpoint = `${config.baseUrl}/campaign/t1/api/v2`;
  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "x-api-key": config.apiKey,
        },
        body: JSON.stringify(payload),
      },
      8000
    );
    const text = await response.text().catch(() => "");
    const data = safeJsonParse(text);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: "request_failed",
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "request_failed",
    };
  }
}
