// Configure Vercel cron:
// path: /api/internal/automation/retry
// schedule: every 5 minutes

import { NextResponse } from "next/server";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";
import { writeHeartbeat } from "@/lib/system/heartbeat";
import { handleEvent } from "@/lib/events/handlers";
import { writeAutomationProcessLog } from "@/lib/system/automationFailures";
import { assertInternalRequest } from "@/lib/auth/assertServerAuth";

interface AutomationFailureRow {
  id?: string | null;
  booking_id?: string | null;
  event?: string | null;
  status?: string | null;
  last_error?: string | null;
  attempts?: number | string | null;
  updated_at?: string | null;
  payload?: unknown;
  meta?: unknown;
}

interface RetryMeta {
  retry_history?: unknown;
  [key: string]: unknown;
}

function eventIsDocumentsGenerate(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/_/g, ".");
  return (
    normalized === "documents.generate" ||
    normalized === "documents.generated" ||
    normalized === "booking.documents.generate" ||
    normalized === "booking.documents.generated"
  );
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withRetryHistory(meta: unknown, retryTimestamp: string): RetryMeta {
  const base: RetryMeta = isRecord(meta) ? { ...meta } : {};
  const existingHistory = Array.isArray(base.retry_history)
    ? base.retry_history
    : [];
  base.retry_history = [...existingHistory, retryTimestamp];
  return base;
}

function parseIso(value: string | null | undefined): number | null {
  const iso = (value ?? "").trim();
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function requiredDelayMs(attempts: number): number {
  if (attempts <= 0) return 5 * 60 * 1000;
  if (attempts === 1) return 15 * 60 * 1000;
  return 45 * 60 * 1000;
}

function isEligibleByBackoff(row: AutomationFailureRow, nowMs: number): boolean {
  const attempts = Math.max(0, toNumber(row.attempts));
  if (attempts >= 3) return false;

  const updatedAtTs = parseIso(row.updated_at);
  if (updatedAtTs === null) return true;
  return nowMs - updatedAtTs >= requiredDelayMs(attempts);
}

function mergeMeta(base: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const normalized = isRecord(base) ? { ...base } : {};
  return { ...normalized, ...patch };
}

async function processRetries(): Promise<{ processed: number; resolved: number; still_failed: number }> {
  const db = new SupabaseRestClient();

  let candidates: AutomationFailureRow[] = [];
  try {
    candidates = await db.selectMany<AutomationFailureRow>(
      "automation_failures",
      new URLSearchParams({
        select: "id,booking_id,event,status,last_error,attempts,updated_at,payload,meta",
        status: "eq.failed",
        attempts: "lt.3",
        order: "updated_at.asc",
        limit: "200",
      })
    );
  } catch {
    return { processed: 0, resolved: 0, still_failed: 0 };
  }

  const nowMs = Date.now();
  const eligible = candidates
    .filter((row) => isEligibleByBackoff(row, nowMs))
    .slice(0, 10);

  let processed = 0;
  let resolved = 0;
  let stillFailed = 0;

  for (const row of eligible) {
    const id = (row.id ?? "").trim();
    if (!id) continue;
    const bookingId = (row.booking_id ?? "").trim() || null;
    const eventName = (row.event ?? "").trim();

    const currentAttempts = Math.max(0, toNumber(row.attempts));
    const nextAttempts = currentAttempts + 1;
    const retryAt = new Date().toISOString();
    const nextMeta = mergeMeta(withRetryHistory(row.meta, retryAt), {
      last_retry_attempt: nextAttempts,
      last_retry_at: retryAt,
    });

    // Claim the row safely so concurrent cron executions do not double-process the same failure.
    const claimQuery = new URLSearchParams({
      id: `eq.${id}`,
      status: "eq.failed",
      attempts: `eq.${currentAttempts}`,
    });

    if ((row.updated_at ?? "").trim()) {
      claimQuery.set("updated_at", `eq.${row.updated_at}`);
    }

    let claimed: AutomationFailureRow | null = null;
    try {
      claimed = await db.updateSingle<AutomationFailureRow>("automation_failures", claimQuery, {
        attempts: nextAttempts,
        status: "retrying",
        updated_at: retryAt,
        meta: nextMeta,
      });
    } catch {
      claimed = null;
    }
    if (!claimed) {
      continue;
    }

    processed += 1;

    let finalStatus: "resolved" | "failed" = "resolved";
    let finalError: string | null = null;
    const finalizedAt = new Date().toISOString();

    try {
      const payloadObject = isRecord(row.payload) ? row.payload : {};
      const effectivePayload = eventIsDocumentsGenerate(eventName)
        ? { ...payloadObject, trigger: "cron_retry" }
        : payloadObject;

      await handleEvent({
        event: eventName,
        bookingId,
        payload: Object.keys(effectivePayload).length > 0 ? effectivePayload : row.meta,
        actorType: "system",
        idempotencyKey: `automation-retry:${id}`,
      });
      finalStatus = "resolved";
    } catch (error) {
      finalStatus = "failed";
      finalError = error instanceof Error ? error.message : "Automation retry failed";
    }

    const finalMeta = mergeMeta(nextMeta, {
      last_retry_outcome: finalStatus,
      last_retry_error: finalError,
      last_retry_processed_at: finalizedAt,
    });

    try {
      await db.updateSingle<AutomationFailureRow>(
        "automation_failures",
        new URLSearchParams({
          id: `eq.${id}`,
          status: "eq.retrying",
          attempts: `eq.${nextAttempts}`,
        }),
        {
          status: finalStatus,
          updated_at: finalizedAt,
          last_error: finalError,
          meta: finalMeta,
        }
      );
    } catch {
      // If final patch fails, leave row in retrying state; the queue remains safe and visible.
    }

    await writeAutomationProcessLog({
      event: eventName || "automation.unknown",
      bookingId,
      failureId: id,
      attempt: nextAttempts,
      outcome: finalStatus,
      message:
        finalStatus === "resolved"
          ? "Automation retry resolved"
          : `Automation retry failed: ${finalError ?? "Unknown error"}`,
    });

    if (finalStatus === "resolved") resolved += 1;
    else stillFailed += 1;
  }

  return { processed, resolved, still_failed: stillFailed };
}

async function handle(req: Request) {
  const internalDenied = assertInternalRequest(req);
  if (internalDenied) return internalDenied;

  try {
    const summary = await processRetries();
    await writeHeartbeat("cron_retry", summary);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return NextResponse.json({ processed: 0, resolved: 0, still_failed: 0 });
    }
    return routeError(500, "Failed to process automation retries");
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
