import crypto from "node:crypto";
import { NextResponse } from "next/server";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "PAYMENT_WEBHOOK_SECRET is not configured" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("x-payment-signature") ?? "";
  const rawBody = await req.text();
  if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  return NextResponse.json({
    received: true,
    message: "Webhook skeleton received payload. Provider mapping pending integration.",
    payloadType:
      payload && typeof payload === "object" && "type" in payload
        ? (payload as { type?: string }).type ?? "unknown"
        : "unknown",
  });
}
