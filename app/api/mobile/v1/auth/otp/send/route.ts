import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import { randomInt } from 'node:crypto';
import argon2 from 'argon2';
// 7 ../ to reach repo root from app/api/mobile/v1/auth/otp/send/
import config from '../../../../../../../payload.config';
import { container } from '../../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';
import { logger } from '../../../../../../../lib/observability/Logger';

const Body = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone'),
});

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid phone', {
        fieldErrors: { phone: parsed.error.issues[0]?.message ?? 'invalid' },
      });
    }

    // Rate limit: 5/hour per phone, 10/day per phone.
    await container.rateLimiter.check(`otp:send:${parsed.data.phone}`, 5, 3600);
    await container.rateLimiter.check(`otp:send:${parsed.data.phone}:daily`, 10, 86400);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await argon2.hash(code, { type: argon2.argon2id });

    const payload = await getPayload({ config });
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const created = await payload.create({
      collection: 'otpRequests',
      data: {
        phone: parsed.data.phone,
        codeHash,
        attempts: 0,
        expiresAt: expiresAt.toISOString(),
      },
    });

    try {
      const send = await container.otpService.send(parsed.data.phone, code);
      await payload.update({
        collection: 'otpRequests',
        id: (created as any).id, // eslint-disable-line @typescript-eslint/no-explicit-any
        data: { messageId: send.messageId },
      });
    } catch (e) {
      logger.error({ traceId, err: e }, 'OTP send failed');
      throw new ApiError(ErrorCode.OTP_PROVIDER_DOWN, 'SMS provider unavailable', {
        retryable: true,
      });
    }

    return jsonResponse(
      { requestId: (created as any).id, expiresAt: expiresAt.toISOString() }, // eslint-disable-line @typescript-eslint/no-explicit-any
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
