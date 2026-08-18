// lib/api/adminAuth.ts
// Staff auth helper — hardened in the known-gaps campaign (B13).
//
// Resolves the operator from Payload's own session machinery: `payload.auth`
// verifies the `payload-token` cookie (set by the Payload admin login at
// /admin) or an `Authorization: JWT <token>` header against every
// auth-enabled collection. Only one such collection exists in this app —
// `users` (Customers is auth:false; mobile clients use custom JWTs that
// payload.auth never sees) — but the collection guard below stays explicit
// so a future auth collection can't silently widen staff access.
//
// Roles: `users` docs carry role admin|editor|ops — all three are staff;
// route-level checks that need a finer split read `user.role` themselves.
//
// Returning undefined (rather than throwing) lets route handlers map the
// "no staff user" outcome to ApiError(TOKEN_EXPIRED) through their normal
// error path, keeping the response envelope consistent.
import type { NextRequest } from "next/server";
import { getPayload } from "payload";
import config from "../../payload.config";

export interface PayloadAdminUser {
  id: string;
  email?: string;
  role?: string;
}

export async function getPayloadAdminUser(
  req: NextRequest,
): Promise<PayloadAdminUser | undefined> {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: req.headers });
  if (!user) return undefined;
  const staff = user as unknown as {
    id?: string | number;
    email?: string;
    role?: string;
    collection?: string;
  };
  if (staff.collection !== "users" || staff.id == null) return undefined;
  return { id: String(staff.id), email: staff.email, role: staff.role };
}
