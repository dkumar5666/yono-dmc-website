// Configure Vercel cron:
// path: /api/internal/automation/retry
// schedule: every 5 minutes

import { NextResponse } from "next/server";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

interface AutomationFailureRow {
  id?: string | null;
  status?: string | null;
  attempts?: number | string | null;
  updated_at?: string | null;
  meta?: unknown;
}

interface RetryMeta {
  retry_history?: unknown;
  [key: string]: unknown;
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

function isUnauthorizedInternalRequest(req: Request): boolean {
  const headerKey = req.headers.get("x-internal-key")?.trim() ?? "";
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key")?.trim() ?? "";
  const validKey = process.env.INTERNAL_CRON_KEY?.trim() ?? "";

  if (!validKey) return true;
  return headerKey !== validKey && queryKey !== validKey;
}

async function processRetries(): Promise<{ processed: number; resolved: number; still_failed: number }> {
  const db = new SupabaseRestClient();
  const eligibleBeforeIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  let candidates: AutomationFailureRow[] = [];
  try {
    candidates = await db.selectMany<AutomationFailureRow>(
      "automation_failures",
      new URLSearchParams({
        select: "id,status,attempts,updated_at,meta",
        status: "eq.failed",
        attempts: "lt.3",
        updated_at: `lt.${eligibleBeforeIso}`,
        order: "updated_at.asc",
        limit: "10",
      })
    );
  } catch {
    return { processed: 0, resolved: 0, still_failed: 0 };
  }

  let processed = 0;
  let resolved = 0;
  let stillFailed = 0;

  for (const row of candidates) {
    const id = (row.id ?? "").trim();
    if (!id) continue;

    const currentAttempts = Math.max(0, toNumber(row.attempts));
    const nextAttempts = currentAttempts + 1;
    const retryAt = new Date().toISOString();
    const nextMeta = withRetryHistory(row.meta, retryAt);

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

    const finalStatus = nextAttempts >= 3 ? "failed" : "resolved";
    const finalUpdatedAt = new Date().toISOString();

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
          updated_at: finalUpdatedAt,
        }
      );
    } catch {
      // If final patch fails, leave row in retrying state; the queue remains safe and visible.
    }

    if (finalStatus === "resolved") resolved += 1;
    else stillFailed += 1;
  }

  return { processed, resolved, still_failed: stillFailed };
}

async function handle(req: Request) {
  if (isUnauthorizedInternalRequest(req)) {
    return routeError(401, "Unauthorized");
  }

  try {
    const summary = await processRetries();
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
