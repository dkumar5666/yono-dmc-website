import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/admin-audit";
import { apiError } from "@/lib/backend/http";
import { buildCopilotSystemPrompt, buildCopilotUserPrompt } from "@/lib/copilot/copilotPrompt";
import { parseCopilotOutput } from "@/lib/copilot/actionMapper";
import { buildCopilotContext } from "@/lib/copilot/contextBuilder";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface ChatBody {
  message?: string;
  context?: {
    booking_id?: string;
    lead_id?: string;
    page?: string;
  };
}

interface OpenAIResponsePayload {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
}

type GenericRow = Record<string, unknown>;

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseActorUsername(auth: ReturnType<typeof requireRole>): string | null {
  const username = auth.claims?.username;
  if (typeof username === "string" && username.trim()) return username.trim();
  if (typeof auth.userId === "string" && auth.userId.startsWith("admin:")) {
    return auth.userId.slice("admin:".length);
  }
  return null;
}

function sanitizeContext(input: ChatBody["context"]): { booking_id?: string; lead_id?: string; page?: string } {
  if (!input || typeof input !== "object") return {};
  const bookingId = safeString(input.booking_id).slice(0, 120);
  const leadId = safeString(input.lead_id).slice(0, 120);
  const page = safeString(input.page).slice(0, 200);
  const next: { booking_id?: string; lead_id?: string; page?: string } = {};
  if (bookingId) next.booking_id = bookingId;
  if (leadId) next.lead_id = leadId;
  if (page) next.page = page;
  return next;
}

function sanitizeMessage(message: string): string {
  return message.trim().slice(0, 4000);
}

function extractAnswer(payload: OpenAIResponsePayload): string {
  const direct = (payload.output_text ?? "").trim();
  if (direct) return direct;

  const chunks =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => (item.text ?? "").trim())
      .filter(Boolean) ?? [];

  return chunks.join("\n\n").trim();
}

function fallbackReply(
  message: string,
  context: Awaited<ReturnType<typeof buildCopilotContext>>
): string {
  return [
    `I could not reach the AI model right now. Here is a quick operational summary for "${message.slice(0, 80)}":`,
    `- Pending payments: ${context.metrics.pendingPayments}`,
    `- Missing documents: ${context.metrics.missingDocuments}`,
    `- Failed automations (24h): ${context.metrics.failedAutomations24h}`,
    `- Open support requests: ${context.metrics.openSupportRequests}`,
    "You can run smoke tests or open pending payments for immediate triage.",
  ].join("\n");
}

async function safeInsert(db: SupabaseRestClient, table: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await db.insertSingle<GenericRow>(table, payload);
    return true;
  } catch {
    return false;
  }
}

async function writeCopilotLogBestEffort(params: {
  db: SupabaseRestClient;
  adminId: string | null;
  actorUsername: string | null;
  message: string;
  reply: string;
  suggestedActions: Array<{ type: string; label: string; payload?: Record<string, unknown> }>;
  source: "openai" | "fallback";
  requestId: string;
  page?: string;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const baseMeta = {
    action_types: params.suggestedActions.map((action) => action.type),
    source: params.source,
    request_id: params.requestId,
    page: params.page || null,
  };

  const copilotPayloads: Array<Record<string, unknown>> = [
    {
      id: randomUUID(),
      admin_id: params.adminId,
      message: params.message,
      reply: params.reply,
      meta: baseMeta,
      created_at: nowIso,
    },
    {
      admin_id: params.adminId,
      message: params.message,
      reply: params.reply,
      meta: baseMeta,
      created_at: nowIso,
    },
    {
      admin_id: params.adminId,
      message: params.message,
      reply: params.reply,
      created_at: nowIso,
    },
  ];

  let inserted = false;
  for (const payload of copilotPayloads) {
    inserted = await safeInsert(params.db, "copilot_logs", payload);
    if (inserted) break;
  }

  if (!inserted) {
    const systemPayloads: Array<Record<string, unknown>> = [
      {
        level: "info",
        event: "copilot_chat",
        entity_type: "admin",
        entity_id: params.adminId || params.actorUsername || "admin",
        message: `Copilot prompt processed (${params.source})`,
        meta: {
          ...baseMeta,
          prompt: params.message.slice(0, 1200),
          reply: params.reply.slice(0, 1200),
        },
        created_at: nowIso,
      },
      {
        event: "copilot_chat",
        message: `Copilot prompt processed (${params.source})`,
        meta: {
          ...baseMeta,
          prompt: params.message.slice(0, 1200),
          reply: params.reply.slice(0, 1200),
        },
      },
    ];
    for (const payload of systemPayloads) {
      inserted = await safeInsert(params.db, "system_logs", payload);
      if (inserted) break;
    }
  }

  await writeAdminAuditLog(params.db, {
    adminId: params.adminId,
    action: "copilot_chat_prompt",
    entityType: "copilot",
    entityId: params.requestId,
    message: "Copilot prompt logged",
    meta: {
      actor_username: params.actorUsername,
      source: params.source,
      action_types: params.suggestedActions.map((action) => action.type),
      page: params.page || null,
    },
  });
}

async function callOpenAI(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ ok: boolean; reply: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        input: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        max_output_tokens: 700,
        temperature: 0.2,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as OpenAIResponsePayload;
    if (!response.ok) {
      return {
        ok: false,
        reply: "",
        error: safeString(payload.error?.message) || `openai_http_${response.status}`,
      };
    }

    const reply = extractAnswer(payload);
    if (!reply) return { ok: false, reply: "", error: "openai_empty_reply" };
    return { ok: true, reply };
  } catch (error) {
    const message = error instanceof Error ? error.message : "openai_request_failed";
    return { ok: false, reply: "", error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  const requestId = getRequestId(req);
  const actorUsername = parseActorUsername(auth);

  try {
    const body = (await req.json().catch(() => ({}))) as ChatBody;
    const message = sanitizeMessage(safeString(body.message));
    if (!message) {
      return apiError(req, 400, "MESSAGE_REQUIRED", "message is required.");
    }
    const contextHint = sanitizeContext(body.context);
    const runtimeContext = await buildCopilotContext();

    const systemPrompt = buildCopilotSystemPrompt(runtimeContext);
    const userPrompt = buildCopilotUserPrompt(message, contextHint);

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

    let source: "openai" | "fallback" = "fallback";
    let rawReply = "";

    if (apiKey) {
      const ai = await callOpenAI({
        apiKey,
        model,
        systemPrompt,
        userPrompt,
      });
      if (ai.ok) {
        source = "openai";
        rawReply = ai.reply;
      } else {
        source = "fallback";
        rawReply = fallbackReply(message, runtimeContext);
        safeLog(
          "[copilot] openai_failed",
          {
            requestId,
            error: ai.error || "unknown",
            hasMessage: Boolean(message),
            source,
          },
          req
        );
      }
    } else {
      rawReply = fallbackReply(message, runtimeContext);
      safeLog(
        "[copilot] missing_openai_key",
        {
          requestId,
          hasMessage: Boolean(message),
          source,
        },
        req
      );
    }

    const parsed = parseCopilotOutput(rawReply, message);
    const reply = parsed.reply;
    const suggestedActions = parsed.suggestedActions;

    try {
      const db = new SupabaseRestClient();
      await writeCopilotLogBestEffort({
        db,
        adminId: auth.userId,
        actorUsername,
        message,
        reply,
        suggestedActions,
        source,
        requestId,
        page: contextHint.page,
      });
    } catch (error) {
      if (!(error instanceof SupabaseNotConfiguredError)) {
        safeLog(
          "[copilot] log_write_failed",
          {
            requestId,
            message: error instanceof Error ? error.message : "unknown",
          },
          req
        );
      }
    }

    const response = NextResponse.json({
      reply,
      suggestedActions,
      source,
      requestId,
      contextSummary: runtimeContext,
    });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    safeLog(
      "[copilot] chat_failed",
      {
        requestId,
        message: error instanceof Error ? error.message : "unknown",
      },
      req
    );
    return apiError(req, 500, "COPILOT_CHAT_FAILED", "Failed to process copilot request.");
  }
}
