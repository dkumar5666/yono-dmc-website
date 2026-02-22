import crypto from "node:crypto";
import { getDb } from "@/lib/backend/sqlite";
import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";

export interface LeadInput {
  name?: string;
  email?: string;
  phone?: string;
}

export interface SuggestedAction {
  label: string;
  href: string;
}

export const aiConversationStatuses = ["new", "in_progress", "resolved"] as const;
export type AIConversationStatus = (typeof aiConversationStatuses)[number];

function sanitizeText(value: unknown, max = 300): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeEmail(value: string): string {
  return sanitizeText(value, 160).toLowerCase();
}

function normalizePhone(value: string): string {
  return sanitizeText(value, 30).replace(/[^\d+]/g, "");
}

function conversationIdBySessionId(sessionId: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM ai_conversations WHERE session_id = ?")
    .get(sessionId) as { id: string } | undefined;
  return row?.id ?? null;
}

function ensureConversation(params: {
  req: Request;
  sessionId: string;
  lead?: LeadInput;
  intent?: string | null;
}): string {
  const db = getDb();
  const existingId = conversationIdBySessionId(params.sessionId);
  const session = getCustomerSessionFromRequest(params.req);

  const leadName = sanitizeText(params.lead?.name, 120);
  const leadEmail = normalizeEmail(params.lead?.email ?? "");
  const leadPhone = normalizePhone(params.lead?.phone ?? "");
  const intent = sanitizeText(params.intent ?? "", 80);

  if (!existingId) {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO ai_conversations (
         id, session_id, customer_id, customer_name, customer_email, customer_phone, detected_intent, last_message_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`
    ).run(
      id,
      params.sessionId,
      session?.id ?? null,
      leadName || session?.name || null,
      leadEmail || session?.email || null,
      leadPhone || session?.phone || null,
      intent || null
    );
    return id;
  }

  db.prepare(
    `UPDATE ai_conversations
     SET customer_id = COALESCE(?, customer_id),
         customer_name = COALESCE(NULLIF(?, ''), customer_name),
         customer_email = COALESCE(NULLIF(?, ''), customer_email),
         customer_phone = COALESCE(NULLIF(?, ''), customer_phone),
         detected_intent = COALESCE(NULLIF(?, ''), detected_intent),
         last_message_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    session?.id ?? null,
    leadName || session?.name || "",
    leadEmail || session?.email || "",
    leadPhone || session?.phone || "",
    intent || "",
    existingId
  );

  return existingId;
}

function appendMessage(params: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: unknown;
}): void {
  const db = getDb();
  const content = sanitizeText(params.content, 6000);
  if (!content) return;

  db.prepare(
    `INSERT INTO ai_messages (id, conversation_id, role, content, metadata_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    params.conversationId,
    params.role,
    content,
    params.metadata ? JSON.stringify(params.metadata) : null
  );

  db.prepare(
    `UPDATE ai_conversations
     SET last_message_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(params.conversationId);
}

export function saveAIExchange(params: {
  req: Request;
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  intent?: string | null;
  lead?: LeadInput;
  actions?: SuggestedAction[];
  source?: "openai" | "fallback";
}): { conversationId: string } {
  const conversationId = ensureConversation({
    req: params.req,
    sessionId: sanitizeText(params.sessionId, 120),
    lead: params.lead,
    intent: params.intent,
  });

  appendMessage({
    conversationId,
    role: "user",
    content: params.userMessage,
    metadata: { intent: params.intent ?? null },
  });

  appendMessage({
    conversationId,
    role: "assistant",
    content: params.assistantMessage,
    metadata: {
      intent: params.intent ?? null,
      actions: params.actions ?? [],
      source: params.source ?? "openai",
    },
  });

  return { conversationId };
}

export function listAIConversations() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         c.id,
         c.session_id,
         c.customer_id,
         c.customer_name,
         c.customer_email,
         c.customer_phone,
         c.detected_intent,
         c.status,
         c.admin_notes,
         c.assigned_to,
         c.last_message_at,
         c.created_at,
         c.updated_at,
         (
           SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id
         ) AS message_count,
         (
           SELECT m2.content
           FROM ai_messages m2
           WHERE m2.conversation_id = c.id
           ORDER BY m2.created_at DESC, m2.id DESC
           LIMIT 1
         ) AS last_message
       FROM ai_conversations c
       ORDER BY c.last_message_at DESC`
    )
    .all() as Array<{
    id: string;
    session_id: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    detected_intent: string | null;
    status: AIConversationStatus;
    admin_notes: string | null;
    assigned_to: string | null;
    last_message_at: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    last_message: string | null;
  }>;

  return rows.map((row) => ({
    ...row,
    last_message: row.last_message ?? "",
  }));
}

export function getAIConversationById(id: string) {
  const db = getDb();
  const conversation = db
    .prepare(
      `SELECT id, session_id, customer_id, customer_name, customer_email, customer_phone,
              detected_intent, status, admin_notes, assigned_to, last_message_at, created_at, updated_at
       FROM ai_conversations
       WHERE id = ?`
    )
    .get(id) as
    | {
        id: string;
        session_id: string;
        customer_id: string | null;
        customer_name: string | null;
        customer_email: string | null;
        customer_phone: string | null;
        detected_intent: string | null;
        status: AIConversationStatus;
        admin_notes: string | null;
        assigned_to: string | null;
        last_message_at: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!conversation) return null;

  const messages = db
    .prepare(
      `SELECT id, role, content, metadata_json, created_at
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(id) as Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    metadata_json: string | null;
    created_at: string;
  }>;

  return {
    ...conversation,
    messages: messages.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      metadata: item.metadata_json ? JSON.parse(item.metadata_json) : null,
      created_at: item.created_at,
    })),
  };
}

export function updateAIConversation(
  id: string,
  input: {
    status?: AIConversationStatus;
    admin_notes?: string;
    assigned_to?: string;
  }
) {
  const db = getDb();
  const existing = db
    .prepare("SELECT id, status, admin_notes, assigned_to FROM ai_conversations WHERE id = ?")
    .get(id) as
    | {
        id: string;
        status: AIConversationStatus;
        admin_notes: string | null;
        assigned_to: string | null;
      }
    | undefined;
  if (!existing) {
    throw new Error("Conversation not found");
  }

  const status = (input.status ?? existing.status ?? "new").trim() as AIConversationStatus;
  if (!aiConversationStatuses.includes(status)) {
    throw new Error("Invalid status");
  }
  const notes = sanitizeText(input.admin_notes ?? existing.admin_notes ?? "", 4000);
  const assignedTo = sanitizeText(input.assigned_to ?? existing.assigned_to ?? "", 120);

  db.prepare(
    `UPDATE ai_conversations
     SET status = ?, admin_notes = ?, assigned_to = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, notes || null, assignedTo || null, id);

  return getAIConversationById(id);
}

export function exportAIConversationsCsv(status?: string): string {
  const rows = listAIConversations().filter((item) =>
    status && status !== "all" ? item.status === status : true
  );

  const header = [
    "id",
    "status",
    "customer_name",
    "customer_email",
    "customer_phone",
    "detected_intent",
    "assigned_to",
    "admin_notes",
    "message_count",
    "last_message_at",
    "last_message",
  ];

  const escapeCsv = (value: unknown) => {
    const raw = String(value ?? "");
    if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
      return `"${raw.replace(/"/g, "\"\"")}"`;
    }
    return raw;
  };

  const lines = rows.map((item) =>
    [
      item.id,
      item.status,
      item.customer_name ?? "",
      item.customer_email ?? "",
      item.customer_phone ?? "",
      item.detected_intent ?? "",
      item.assigned_to ?? "",
      item.admin_notes ?? "",
      item.message_count,
      item.last_message_at,
      item.last_message,
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [header.join(","), ...lines].join("\n");
}
