import { apiError, apiSuccess } from "@/lib/backend/http";
import { requireAdmin } from "@/lib/backend/adminAuth";
import {
  AIConversationStatus,
  aiConversationStatuses,
  getAIConversationById,
  updateAIConversation,
} from "@/lib/backend/aiConversations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteParams) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await ctx.params;
    const conversation = getAIConversationById(id);
    if (!conversation) {
      return apiError(req, 404, "AI_CONVERSATION_NOT_FOUND", "Conversation not found.");
    }
    return apiSuccess(req, { conversation });
  } catch {
    return apiError(req, 500, "AI_CONVERSATION_FETCH_ERROR", "Failed to load conversation.");
  }
}

export async function PATCH(req: Request, ctx: RouteParams) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      status?: string;
      admin_notes?: string;
      assigned_to?: string;
    };

    if (
      body.status &&
      !aiConversationStatuses.includes(body.status as AIConversationStatus)
    ) {
      return apiError(req, 400, "INVALID_STATUS", "Invalid status value.");
    }

    const updated = updateAIConversation(id, {
      status: body.status as AIConversationStatus | undefined,
      admin_notes: body.admin_notes,
      assigned_to: body.assigned_to,
    });
    if (!updated) {
      return apiError(req, 404, "AI_CONVERSATION_NOT_FOUND", "Conversation not found.");
    }
    return apiSuccess(req, { conversation: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update conversation.";
    if (message === "Conversation not found") {
      return apiError(req, 404, "AI_CONVERSATION_NOT_FOUND", message);
    }
    return apiError(req, 500, "AI_CONVERSATION_UPDATE_ERROR", message);
  }
}
