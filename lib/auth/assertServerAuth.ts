import "server-only";

import { AuthRole } from "@/lib/auth/getUserRoleFromJWT";
import { requireRole, RequireRoleResult } from "@/lib/middleware/requireRole";
import { routeError } from "@/lib/middleware/routeError";
import { isAuthorizedInternalRequest } from "@/lib/security/internalAuth";

type AllowedRoles = AuthRole | AuthRole[];

export function assertServerAuth(req: Request, allowed: AllowedRoles): RequireRoleResult {
  return requireRole(req, allowed);
}

export function assertInternalRequest(req: Request) {
  if (isAuthorizedInternalRequest(req)) return null;
  return routeError(401, "Unauthorized");
}
