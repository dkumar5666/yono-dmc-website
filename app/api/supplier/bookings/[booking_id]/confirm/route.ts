import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import {
  resolveSupplierBookingActionContext,
  triggerSupplierConfirmedEvent,
  updateBookingSupplierStatus,
  updateSupplierServiceStatus,
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

  let note = "";
  let payload: unknown = null;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    note = safeString(body?.message) || safeString(body?.note);
    payload = body?.payload ?? null;
  } catch {
    // optional body
  }

  await updateSupplierServiceStatus(context, "confirmed");
  await updateBookingSupplierStatus(context, "confirmed");

  const message = note || "Supplier confirmed service from portal";
  await writeSupplierLog({
    context,
    action: "confirm",
    status: "success",
    message,
    payload,
  });
  await writeSupplierSystemLog({
    context,
    event: "supplier.confirmed",
    message,
    meta: {
      action: "confirm",
    },
  });
  await triggerSupplierConfirmedEvent(context);

  return NextResponse.json({
    ok: true,
    booking_id: context.bookingRef,
    message: "Service confirmed",
  });
}

