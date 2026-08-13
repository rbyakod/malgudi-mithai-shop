// app/api/mobile/v1/auth/apple/route.ts
// Sign in with Apple — Task 15.3.
//
// The iOS client obtains an `identityToken` (RS256 JWT) from
// ASAuthorizationAppleIDCredential and POSTs it here. We:
//   1. Reject replay — the same identityToken may not be used twice (409).
//      Reuse is suspicious because tokens are single-use, short-lived (10m);
//      a repeat implies capture/replay. Guard is persistent (idempotencyKeys
//      collection, 24h TTL) so it survives across serverless invocations.
//   2. Verify the token via container.appleAuthService (AppleJwksService in
//      prod; FakeAppleAuthService in test). Failure → 401.
//   3. Upsert a customer keyed by the stable Apple `sub`. Apple customers
//      have no phone — they carry email + appleSub + authProvider='apple'.
//   4. Issue the same JWT pair + customer shape as /auth/otp/verify so the
//      client's post-login flow is identical regardless of auth method.
//
// Path depth: app/api/mobile/v1/auth/apple/ = 6 dirs under app/ -> 6 `../`.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import { createHash } from 'node:crypto';
import config from '../../../../../../payload.config';
import { container } from '../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

const Body = z.object({
  identityToken: z.string().min(1),
  // Optional display name the client may pass on first authorization.
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid Apple auth body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const { identityToken, name } = parsed.data;

    // --- Replay guard (Step 5): same identityToken twice → 409 -------------
    const tokenHash = createHash('sha256').update(identityToken).digest('hex');
    const guardKey = `apple:${tokenHash}`;
    const payload = await getPayload({ config });
    const reused = await payload.find({
      collection: 'idempotencyKeys',
      where: { key: { equals: guardKey } },
      limit: 1,
    });
    if (reused.docs[0]) {
      throw new ApiError(ErrorCode.CONFLICT, 'Apple identity token already used');
    }

    // --- Verify (Step 3) --------------------------------------------------
    let identity;
    try {
      identity = await container.appleAuthService.verifyIdentityToken(identityToken);
    } catch {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Invalid Apple identity token');
    }

    // --- Upsert customer by Apple sub ------------------------------------
    const existing = (await payload.find({
      collection: 'customers',
      where: { appleSub: { equals: identity.sub } },
      limit: 1,
    })) as unknown as {
      docs: Array<{ id: string; phone?: string | null; name?: string | null; email?: string | null; locale?: string }>;
    };
    let customer = existing.docs[0];
    if (!customer) {
      customer = (await payload.create({
        collection: 'customers',
        data: {
          appleSub: identity.sub,
          email: identity.email ?? undefined,
          authProvider: 'apple',
          locale: 'en',
          name,
        },
      })) as unknown as typeof customer;
    } else if (identity.email && !customer.email) {
      // First authorization is the only time Apple returns email; back-fill.
      await payload.update({
        collection: 'customers',
        id: customer.id,
        data: { email: identity.email },
      });
      customer = { ...customer, email: identity.email };
    }

    // --- Issue JWT pair ---------------------------------------------------
    const accessToken = await container.jwtService.issueAccessToken(customer.id);
    const refreshToken = await container.jwtService.issueRefreshToken(customer.id);

    // --- Mark token consumed (replay guard) -------------------------------
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await payload.create({
      collection: 'idempotencyKeys',
      data: { key: guardKey, requestHash: tokenHash, responseStatus: 200, responseBody: {}, expiresAt },
    });

    return jsonResponse(
      {
        accessToken,
        refreshToken,
        customer: {
          id: customer.id,
          phone: customer.phone ?? null,
          name: customer.name ?? null,
          email: customer.email ?? null,
          locale: customer.locale ?? 'en',
        },
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
