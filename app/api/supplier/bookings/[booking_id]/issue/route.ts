import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import {
  resolveSupplierBookingActionContext,
  updateBookingSupplierStatus,
  writeSupplierLog,
  writeSupplierSystemLog,
} from "../_lib";

type Params = { booking_id: string };

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request, { params }: { params: Params | Promise<Params> }) {
  const auth = requireRole(req, "supplier");
  if (auth.denied) return auth.denied;
  if (!auth.userId) return routeError(401, "Not authenticated");

  const resolvedParams = "then" in params ? await params : params;
  const bookingRef = decodeURIComponent(resolvedParams.booking_id ?? "").trim();
  if (!bookingRef) return routeError(404, "Booking not found");

  const context = await resolveSupplierBookingActionContext({
    userId: auth.userId,
    bookingRef,
  });
  if (!context) return routeError(404, "Booking not found");

  let issueMessage = "";
  let payload: unknown = null;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    issueMessage = safeString(body?.message) || safeString(body?.issue);
    payload = body?.payload ?? body ?? null;
  } catch {
    // parsed below
  }

  if (!issueMessage) {
    return NextResponse.json(
      {
        success: false,
        error: "Issue message is required",
      },
      { status: 400 }
    );
  }

  await updateBookingSupplierStatus(context, "issue_reported");

  await writeSupplierLog({
    context,
    action: "issue",
    status: "failed",
    message: issueMessage,
    payload,
  });

  await writeSupplierSystemLog({
    context,
    event: "supplier.issue_reported",
    level: "warn",
    message: issueMessage,
    meta: {
      action: "issue",
    },
  });

  return NextResponse.json({
    ok: true,
    booking_id: context.bookingRef,
    message: "Issue reported to operations",
  });
}

