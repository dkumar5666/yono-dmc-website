import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

interface RecordAutomationFailureInput {
  bookingId?: string | null;
  event: string;
  errorMessage: string;
  attempts?: number;
  payload?: unknown;
  meta?: unknown;
}

interface AutomationProcessLogInput {
  event: string;
  bookingId?: string | null;
  failureId?: string | null;
  attempt?: number;
  outcome: "resolved" | "failed" | "skipped";
  message?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function truncate(value: string, max = 500): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function looksLikeMissingTable(message: string, table: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("42p01") ||
    (lower.includes("relation") && lower.includes("does not exist") && lower.includes(table))
  );
}

async function tryInsertSystemLog(
  db: SupabaseRestClient,
  payload: Record<string, unknown>
): Promise<void> {
  const variants: Array<Record<string, unknown>> = [
    payload,
    {
      level: payload.level,
      event: payload.event,
      message: payload.message,
      meta: payload.meta,
    },
    {
      level: payload.level,
      message: payload.message,
      meta: payload.meta,
    },
    {
      message: payload.message,
      meta: payload.meta,
    },
  ];

  for (const variant of variants) {
    try {
      await db.insertSingle("system_logs", variant);
      return;
    } catch {
      // Try a smaller payload.
    }
  }
}

export async function recordAutomationFailure(
  input: RecordAutomationFailureInput
): Promise<void> {
  const event = safeString(input.event) || "automation.unknown";
  const errorMessage = truncate(safeString(input.errorMessage) || "Unknown automation error");
  const attempts = Math.max(0, toFiniteNumber(input.attempts, 0));
  const bookingId = safeString(input.bookingId) || null;
  const updatedAt = new Date().toISOString();

  try {
    const db = new SupabaseRestClient();
    const basePayload: Record<string, unknown> = {
      booking_id: bookingId,
      event,
      status: "failed",
      attempts,
      last_error: errorMessage,
      payload: input.payload ?? null,
      meta: input.meta ?? null,
      updated_at: updatedAt,
    };

    try {
      await db.insertSingle("automation_failures", basePayload);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!looksLikeMissingTable(message, "automation_failures")) {
        // If insert failed for a non-table reason, still continue to fallback logs.
      }
    }

    const eventFailureAttempts: Array<Record<string, unknown>> = [
      {
        booking_id: bookingId,
        event,
        status: "failed",
        attempts,
        last_error: errorMessage,
        payload: input.payload ?? null,
        meta: input.meta ?? null,
      },
      {
        booking_id: bookingId,
        event,
        status: "failed",
        error: errorMessage,
        payload: input.payload ?? null,
        meta: input.meta ?? null,
      },
    ];

    for (const payload of eventFailureAttempts) {
      try {
        await db.insertSingle("event_failures", payload);
        return;
      } catch {
        // Fall through to system log fallback.
      }
    }

    await tryInsertSystemLog(db, {
      level: "error",
      event: "automation.failure",
      booking_id: bookingId,
      message: `${event} failed`,
      meta: {
        event,
        booking_id: bookingId,
        error: errorMessage,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

export async function writeAutomationProcessLog(
  input: AutomationProcessLogInput
): Promise<void> {
  const event = safeString(input.event) || "automation.unknown";
  const bookingId = safeString(input.bookingId) || null;
  const failureId = safeString(input.failureId) || null;
  const attempt = input.attempt ?? null;
  const message =
    safeString(input.message) ||
    `Automation retry ${input.outcome}: ${event}`;

  try {
    const db = new SupabaseRestClient();
    await tryInsertSystemLog(db, {
      level: input.outcome === "failed" ? "error" : "info",
      event: "automation.retry",
      booking_id: bookingId,
      message,
      meta: {
        event,
        booking_id: bookingId,
        failure_id: failureId,
        attempt,
        outcome: input.outcome,
      },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

