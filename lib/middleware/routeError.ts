import crypto from "node:crypto";
import { NextResponse } from "next/server";

function normalizeCode(message: string, status: number): string {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (normalized) return normalized;
  return `http_${status}`;
}

export function routeError(
  status: 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503,
  message: string,
  code?: string
) {
  const requestId = crypto.randomUUID().slice(0, 12);
  const payload = {
    ok: false,
    success: false,
    error: message,
    code: code || normalizeCode(message, status),
    requestId,
  };
  const response = NextResponse.json(payload, { status });
  response.headers.set("x-request-id", requestId);
  return response;
}
