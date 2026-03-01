import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { buildRevenueOptimizerData } from "@/lib/revenue/optimizerRules";
import { enrichRevenueOptimizerWithAi } from "@/lib/revenue/optimizerAi";
import { storeRevenueRecommendations } from "@/lib/revenue/recommendationStore";

function toMinMargin(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(0, parsed);
}

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const minMarginPercent = toMinMargin(process.env.MIN_MARGIN_PERCENT);
    const baseData = await buildRevenueOptimizerData({
      minMarginPercent,
    });

    const aiResult = await enrichRevenueOptimizerWithAi({
      hotLeads: baseData.hotLeads,
      quoteOpportunities: baseData.quoteOpportunities,
      abandonedPayments: baseData.abandonedPayments,
      insights: baseData.insights,
    });

    const responsePayload = {
      hotLeads: aiResult.hotLeads,
      quoteOpportunities: baseData.quoteOpportunities,
      abandonedPayments: baseData.abandonedPayments,
      insights: {
        ...baseData.insights,
        summary: aiResult.summary || baseData.insights.summary,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        minMarginPercent,
      },
    };

    try {
      const db = new SupabaseRestClient();
      await storeRevenueRecommendations({
        db,
        adminId: auth.userId,
        data: responsePayload,
      });
    } catch {
      // recommendation storage is best-effort
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(503, "Supabase is not configured");
    }
    return routeError(500, "Failed to load revenue optimizer");
  }
}

