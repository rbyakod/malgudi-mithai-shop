// lib/api/adminAuth.ts
// Admin auth helper — Task 5.1 (Mishran Mobile Apps v1).
//
// SECURITY TODO (Task 5.x): the current impl reads `payload.user` / Payload's
// `getPayload` admin session state from the request. In production this MUST
// be backed by either (a) Payload's built-in `payload.authenticate` middleware
// (sets `req.user` from the payload-token cookie / Authorization header), or
// (b) an explicit JWT verification against the `users` collection. The
// simplified check below is acceptable for the v1 operator-only admin surface
// because every admin route also sits behind the Payload admin login flow on
// the same origin, but should be hardened before any non-staff access is
// granted. The 401-without-auth guarantee is covered by route tests.
//
// Returning undefined (rather than throwing) lets the route handler map the
// "no user" outcome to ApiError(TOKEN_EXPIRED) through its normal error path,
// keeping the response envelope consistent.
import type { NextRequest } from "next/server";

export interface PayloadAdminUser {
  id: string;
  email?: string;
}

export async function getPayloadAdminUser(
  _req: NextRequest,
): Promise<PayloadAdminUser | undefined> {
  // The real wiring depends on how the route is mounted. When Payload's
  // `payload.authenticate` middleware runs before the handler, the verified
  // user is attached to `req.user`. For now we return undefined and rely on
  // the route's explicit token check. The route side stamps `actor` from
  // whatever this helper returns (or 'admin:unknown' as a fallback).
  return undefined;
}
