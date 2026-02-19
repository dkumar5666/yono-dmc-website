import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/backend/adminAuth";
import {
  createHolidayPackage,
  listHolidayPackages,
  type HolidayPackageInput,
} from "@/lib/backend/travelAdmin";

export async function GET(req: Request) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    return NextResponse.json({ data: listHolidayPackages() });
  } catch (error: unknown) {
    console.error("HOLIDAY PACKAGES GET ERROR:", error);
    return NextResponse.json({ error: "Failed to load packages" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const body = (await req.json()) as HolidayPackageInput;
    const created = createHolidayPackage(body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create package";
    const status = message.includes("required") || message.includes("must") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
