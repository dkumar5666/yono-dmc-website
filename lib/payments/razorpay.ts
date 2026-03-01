import "server-only";

interface CreateRazorpayPaymentLinkInput {
  amount: number;
  currency: string;
  referenceId: string;
  description?: string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  notes?: Record<string, unknown> | null;
}

export interface RazorpayPaymentLinkResult {
  ok: boolean;
  id?: string;
  shortUrl?: string;
  error?: string;
  status?: number;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: number): number {
  return Math.max(1, Math.round(value));
}

function toCurrency(value: string): string {
  const normalized = safeString(value).toUpperCase();
  return normalized || "INR";
}

async function parseJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const json = (await response.json()) as unknown;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return json as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  controller.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true });
  return controller.signal;
}

export async function createRazorpayPaymentLink(
  input: CreateRazorpayPaymentLinkInput
): Promise<RazorpayPaymentLinkResult> {
  const keyId = safeString(process.env.RAZORPAY_KEY_ID);
  const keySecret = safeString(process.env.RAZORPAY_KEY_SECRET);
  if (!keyId || !keySecret) {
    return { ok: false, error: "razorpay_config_missing" };
  }

  const amount = toNumber(input.amount);
  if (amount === null || amount <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const body: Record<string, unknown> = {
    amount: toInt(amount * 100),
    currency: toCurrency(input.currency),
    reference_id: safeString(input.referenceId),
    description: safeString(input.description) || undefined,
    accept_partial: false,
  };

  const customerName = safeString(input.customer?.name);
  const customerEmail = safeString(input.customer?.email);
  const customerPhone = safeString(input.customer?.phone);
  if (customerName || customerEmail || customerPhone) {
    body.customer = {
      ...(customerName ? { name: customerName } : {}),
      ...(customerEmail ? { email: customerEmail } : {}),
      ...(customerPhone ? { contact: customerPhone } : {}),
    };
  }

  if (input.notes && typeof input.notes === "object") {
    body.notes = input.notes;
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const signal = withTimeout(8000);

  try {
    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });

    const json = await parseJsonSafe(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: safeString(json?.error && typeof json.error === "object" ? (json.error as Record<string, unknown>).description : json?.error) || "razorpay_payment_link_failed",
      };
    }

    return {
      ok: true,
      status: response.status,
      id: safeString(json?.id) || undefined,
      shortUrl: safeString(json?.short_url) || undefined,
    };
  } catch {
    return {
      ok: false,
      error: "razorpay_payment_link_request_failed",
    };
  }
}

