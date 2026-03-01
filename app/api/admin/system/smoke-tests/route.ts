import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { runSystemSmokeTests } from "@/lib/system/smokeTests";
import { getRequestId } from "@/lib/system/requestContext";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const result = await runSystemSmokeTests(req);
    const response = NextResponse.json(result);
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    const response = NextResponse.json(
      {
        ok: false,
        error: "Smoke test execution failed unexpectedly.",
        code: "smoke_tests_failed",
        requestId,
        checks: [
          {
            name: "Smoke test runner",
            status: "fail",
            detail: "Smoke test execution failed unexpectedly.",
            action: "Check server logs and retry.",
          },
        ],
        meta: {
          timestamp: new Date().toISOString(),
          appMode: "production",
        },
      },
      { status: 500 }
    );
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
