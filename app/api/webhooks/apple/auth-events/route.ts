// app/api/webhooks/apple/auth-events/route.ts
// Apple Sign-in revocation webhook — Task 20.5.
//
// Apple's servers POST a JWT to this endpoint when a user revokes Sign in
// with Apple (or disables the relay email). The body is the raw token, or
// `payload=<token>` form-encoded. We verify the token against Apple's JWKS
// (container.appleAuthService) and process the `events` array:
//   - consent-revoked → clear the customer's appleSub + write a
//     force-logout sentinel (`all:<customerId>` in revokedTokens, which the
//     container's isRevoked callback honors for every session) so the next
//     refresh attempt returns 401 and the client lands on sign-in.
//   - email-disabled / email-relay-change → clear the stored Apple email.
//
// Always 200 on a VALID token (even no-op subs) — Apple retries non-2xx
// for days; an unknown sub must not become a retry storm. Only a token
// that fails verification returns 401 so Apple retries with a fresh one.
//
// Path depth: app/api/webhooks/apple/auth-events/ = 5 dirs under app/ -> 5 `../`.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';
import { container } from '../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../lib/api/errors';

/** Sentinel row: revokes every live token of a customer (see container.isRevoked). */
function forceLogoutSentinel(customerId: string): string {
  return `all:${customerId}`;
}

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let token: string;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      token = new URLSearchParams(await req.text()).get('payload') ?? '';
    } else {
      token = (await req.text()).trim();
    }
    if (!token) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Missing event token');
    }

    let events: Array<{ type?: string; sub?: string }>;
    try {
      events = await container.appleAuthService.verifyServerEventToken(token);
    } catch {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Invalid Apple event token');
    }

    const payload = await getPayload({ config });
    let processed = 0;
    for (const event of events) {
      if (!event.sub) continue;
      const found = (await payload.find({
        collection: 'customers',
        where: { appleSub: { equals: event.sub } },
        limit: 1,
      })) as unknown as { docs: Array<{ id: string }> };
      const customer = found.docs[0];
      if (!customer) continue;

      if (event.type === 'consent-revoked') {
        await payload.update({
          collection: 'customers',
          id: customer.id,
          data: { appleSub: null },
        });
        await payload.create({
          collection: 'revokedTokens',
          data: {
            jti: forceLogoutSentinel(customer.id),
            customerId: customer.id,
            reason: 'revoked',
            // Outlives every refresh token that could have been issued
            // before the revocation (30d rotation window).
            expiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
          },
        });
        processed += 1;
      } else if (event.type === 'email-disabled' || event.type === 'email-relay-change') {
        await payload.update({
          collection: 'customers',
          id: customer.id,
          data: { email: null },
        });
        processed += 1;
      }
    }

    return jsonResponse({ processed }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
