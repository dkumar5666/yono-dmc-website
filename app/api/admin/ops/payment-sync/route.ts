import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { getRequestId } from "@/lib/system/requestContext";
import { createOpsDb, runPaymentSyncAction } from "@/lib/ops/opsActions";
import { ensureConfirmed, respondOpsAction } from "../_shared";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      payment_id?: string;
      provider_payment_id?: string;
      provider_order_id?: string;
      confirm?: boolean;
    };
    if (!ensureConfirmed(body)) {
      return routeError(400, "Confirmation is required");
    }
    if (!body.payment_id && !body.provider_payment_id && !body.provider_order_id) {
      return routeError(400, "payment_id or provider reference is required");
    }

    const db = createOpsDb();
    if (!db) return routeError(500, "Supabase is not configured");

    const result = await runPaymentSyncAction(
      db,
      {
        paymentId: body.payment_id,
        providerPaymentId: body.provider_payment_id,
        providerOrderId: body.provider_order_id,
      },
      {
        userId: auth.userId,
        role: auth.role,
        username: typeof auth.claims.username === "string" ? auth.claims.username : null,
      }
    );
    return respondOpsAction(result, requestId);
  } catch {
    return routeError(500, "Failed to run payment sync action");
  }
}
