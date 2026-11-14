/**
 * Shared HTTP helpers for route handlers. OWNER: Developer 1.
 */
import type { ApiError } from "@/lib/contracts";

export function apiError(status: number, code: ApiError["error"]["code"], message: string, extra: Partial<ApiError["error"]> = {}) {
  const body: ApiError = { error: { code, message, ...extra } };
  return Response.json(body, { status });
}

/** Honest placeholder: the route exists in the contract but is not implemented yet. */
export function notImplemented(route: string, issue: string) {
  return apiError(501, "not_implemented", `${route} is defined in lib/contracts/api.ts but not implemented yet.`, { issue });
}
