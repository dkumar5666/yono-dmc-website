import { NextResponse } from "next/server";
import { OpsActionResult } from "@/lib/ops/opsActions";

export function statusFromActionCode(code: string): number {
  if (code.endsWith("_missing") || code === "query_missing") return 400;
  if (code.endsWith("_not_found") || code === "payment_not_found" || code === "failure_not_found") return 404;
  if (code.includes("unavailable") || code.includes("unreachable")) return 503;
  if (code.includes("failed")) return 502;
  return 400;
}

export function jsonWithRequestId(
  payload: Record<string, unknown>,
  requestId: string,
  status = 200
): NextResponse {
  const response = NextResponse.json(
    {
      ...payload,
      requestId,
    },
    { status }
  );
  response.headers.set("x-request-id", requestId);
  return response;
}

export function ensureConfirmed(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = (body as { confirm?: unknown }).confirm;
  return value === true;
}

export function respondOpsAction(result: OpsActionResult, requestId: string): NextResponse {
  if (!result.ok) {
    return jsonWithRequestId(
      {
        ok: false,
        code: result.code,
        error: result.message,
        data: result.data ?? null,
      },
      requestId,
      statusFromActionCode(result.code)
    );
  }
  return jsonWithRequestId(
    {
      ok: true,
      code: result.code,
      message: result.message,
      data: result.data ?? null,
    },
    requestId
  );
}
