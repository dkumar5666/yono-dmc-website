import { NextResponse } from "next/server";
import { clearCustomerSessionCookie } from "@/lib/backend/customerAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearCustomerSessionCookie(response);
  return response;
}

