import { apiError, apiSuccess } from "@/lib/backend/http";
import { requireAdmin } from "@/lib/backend/adminAuth";
import {
  aiConversationStatuses,
  exportAIConversationsCsv,
  listAIConversations,
} from "@/lib/backend/aiConversations";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "all";
    const format = url.searchParams.get("format") ?? "json";

    if (
      status !== "all" &&
      !aiConversationStatuses.includes(status as (typeof aiConversationStatuses)[number])
    ) {
      return apiError(req, 400, "INVALID_STATUS", "Invalid status filter.");
    }

    if (format === "csv") {
      const csv = exportAIConversationsCsv(status);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"ai-conversations-${new Date()
            .toISOString()
            .slice(0, 10)}.csv\"`,
        },
      });
    }

    const conversations = listAIConversations().filter((item) =>
      status !== "all" ? item.status === status : true
    );
    return apiSuccess(req, { conversations });
  } catch {
    return apiError(req, 500, "AI_CONVERSATIONS_LIST_ERROR", "Failed to load AI conversations.");
  }
}
