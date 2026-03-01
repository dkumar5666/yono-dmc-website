import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { assertServerAuth } from "@/lib/auth/assertServerAuth";
import { routeError } from "@/lib/middleware/routeError";

type CheckStatus = "pass" | "warn" | "fail";

interface SecurityCheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

interface SecurityCheckResponse {
  ok: boolean;
  checks: SecurityCheckResult[];
  timestamp: string;
}

async function listRouteFiles(rootDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries: Array<{ name: string; isDirectory: boolean }> = [];
    try {
      const raw = await fs.readdir(dir, { withFileTypes: true });
      entries = raw.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory) {
        await walk(full);
      } else if (entry.name === "route.ts") {
        out.push(full);
      }
    }
  }
  await walk(rootDir);
  return out;
}

function hasExpectedRoleGuard(content: string, role: "admin" | "agent" | "supplier"): boolean {
  const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`requireRole\\(\\s*req\\s*,\\s*"${escaped}"`),
    new RegExp(`requireRole\\(\\s*req\\s*,\\s*\\[[^\\]]*"${escaped}"`),
    new RegExp(`assertServerAuth\\(\\s*req\\s*,\\s*"${escaped}"`),
    new RegExp(`assertServerAuth\\(\\s*req\\s*,\\s*\\[[^\\]]*"${escaped}"`),
  ];
  return patterns.some((pattern) => pattern.test(content));
}

async function checkRoleCoverage(
  routeRoot: string,
  role: "admin" | "agent" | "supplier"
): Promise<string[]> {
  const files = await listRouteFiles(routeRoot);
  const missing: string[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    if (!hasExpectedRoleGuard(content, role)) {
      missing.push(filePath.replace(process.cwd() + path.sep, "").replace(/\\/g, "/"));
    }
  }

  return missing;
}

async function checkInternalKeyCoverage(routeRoot: string): Promise<string[]> {
  const files = await listRouteFiles(routeRoot);
  const missing: string[] = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const hasInternalGuard =
      content.includes("isAuthorizedInternalRequest(") ||
      content.includes("assertInternalRequest(") ||
      content.includes("hasValidCronKey(");

    if (!hasInternalGuard) {
      missing.push(filePath.replace(process.cwd() + path.sep, "").replace(/\\/g, "/"));
    }
  }

  return missing;
}

async function collectSourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string) {
    let entries: Array<{ name: string; isDirectory: boolean }> = [];
    try {
      const raw = await fs.readdir(dir, { withFileTypes: true });
      entries = raw.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory) {
        await walk(full);
      } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        files.push(full);
      }
    }
  }
  await walk(root);
  return files;
}

async function checkServiceRoleLeakage(): Promise<string[]> {
  const appFiles = await collectSourceFiles(path.join(process.cwd(), "app"));
  const componentFiles = await collectSourceFiles(path.join(process.cwd(), "components"));
  const files = [...appFiles, ...componentFiles];

  const leaked: string[] = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    if (!content.startsWith('"use client";') && !content.startsWith("'use client';")) continue;
    if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      leaked.push(filePath.replace(process.cwd() + path.sep, "").replace(/\\/g, "/"));
    }
  }
  return leaked;
}

export async function GET(req: Request) {
  const auth = assertServerAuth(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const checks: SecurityCheckResult[] = [];

    const adminMissing = await checkRoleCoverage(path.join(process.cwd(), "app/api/admin"), "admin");
    checks.push({
      name: "admin_api_role_guards",
      status: adminMissing.length === 0 ? "pass" : "fail",
      detail:
        adminMissing.length === 0
          ? "All /api/admin routes include admin role checks."
          : `Missing admin guard in: ${adminMissing.join(", ")}`,
    });

    const agentMissing = await checkRoleCoverage(path.join(process.cwd(), "app/api/agent"), "agent");
    checks.push({
      name: "agent_api_role_guards",
      status: agentMissing.length === 0 ? "pass" : "fail",
      detail:
        agentMissing.length === 0
          ? "All /api/agent routes include agent role checks."
          : `Missing agent guard in: ${agentMissing.join(", ")}`,
    });

    const supplierMissing = await checkRoleCoverage(path.join(process.cwd(), "app/api/supplier"), "supplier");
    checks.push({
      name: "supplier_api_role_guards",
      status: supplierMissing.length === 0 ? "pass" : "fail",
      detail:
        supplierMissing.length === 0
          ? "All /api/supplier routes include supplier role checks."
          : `Missing supplier guard in: ${supplierMissing.join(", ")}`,
    });

    const internalMissing = await checkInternalKeyCoverage(path.join(process.cwd(), "app/api/internal"));
    checks.push({
      name: "internal_api_key_protection",
      status: internalMissing.length === 0 ? "pass" : "fail",
      detail:
        internalMissing.length === 0
          ? "All /api/internal routes include key-based protection."
          : `Missing internal key checks in: ${internalMissing.join(", ")}`,
    });

    const unauthReq = new Request("https://example.com/api/security-check");
    const adminDenied = assertServerAuth(unauthReq, "admin").denied;
    const agentDenied = assertServerAuth(unauthReq, "agent").denied;
    const supplierDenied = assertServerAuth(unauthReq, "supplier").denied;
    const unauthGuardPass =
      (adminDenied?.status === 401 || adminDenied?.status === 403) &&
      (agentDenied?.status === 401 || agentDenied?.status === 403) &&
      (supplierDenied?.status === 401 || supplierDenied?.status === 403);

    checks.push({
      name: "unauthenticated_access_blocked",
      status: unauthGuardPass ? "pass" : "fail",
      detail: unauthGuardPass
        ? "Unauthenticated requests are blocked for admin/agent/supplier guards."
        : "One or more portal guards did not block unauthenticated request in self-test.",
    });

    const leakedServiceKeyFiles = await checkServiceRoleLeakage();
    checks.push({
      name: "service_role_client_leak_check",
      status: leakedServiceKeyFiles.length === 0 ? "pass" : "fail",
      detail:
        leakedServiceKeyFiles.length === 0
          ? "No SUPABASE_SERVICE_ROLE_KEY usage found in client components."
          : `Potential service-role leakage in: ${leakedServiceKeyFiles.join(", ")}`,
    });

    const crossPortalHint =
      "Cross-session simulation is limited in this endpoint; use manual role login tests for portal-to-portal access.";
    checks.push({
      name: "cross_portal_manual_test",
      status: "warn",
      detail: crossPortalHint,
    });

    const payload: SecurityCheckResponse = {
      ok: checks.every((check) => check.status !== "fail"),
      checks,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(payload);
  } catch {
    return routeError(500, "Failed to run security checks");
  }
}
