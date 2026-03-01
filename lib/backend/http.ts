import crypto from "node:crypto";
import { NextResponse } from "next/server";

export interface ErrorPayload {
  ok: false;
  code: string;
  message: string;
  requestId: string;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export interface SuccessPayload<T> {
  ok: true;
  data: T;
  requestId: string;
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function apiError(
  req: Request,
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse<ErrorPayload> {
  const requestId = getRequestId(req);
  const payload: ErrorPayload = {
    ok: false,
    code,
    message,
    requestId,
    error: { code, message, requestId, details },
  };
  const response = NextResponse.json(payload, { status });
  response.headers.set("x-request-id", requestId);
  return response;
}

export function apiSuccess<T>(
  req: Request,
  data: T,
  status = 200
): NextResponse<SuccessPayload<T>> {
  const requestId = getRequestId(req);
  const payload: SuccessPayload<T> = { ok: true, data, requestId };
  const response = NextResponse.json(payload, { status });
  response.headers.set("x-request-id", requestId);
  return response;
}
