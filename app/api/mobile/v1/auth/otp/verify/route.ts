import { NextRequest } from 'next/server';
import { z } from 'zod';
import argon2 from 'argon2';
import { getPayload } from 'payload';
// 7 ../ to reach repo root from app/api/mobile/v1/auth/otp/verify/
import config from '../../../../../../../payload.config';
import { container } from '../../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../../lib/api/errors';
import { isBypassPhone } from '../../../../../../../lib/auth/bypassPhones';

const Body = z.object({
  requestId: z.string().min(1),
  code: z.string().regex(/^[0-9]{6}$/, 'Must be 6 digits'),
});

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid input', {
        fieldErrors: { code: parsed.error.issues[0]?.message ?? 'invalid' },
      });
    }

    const payload = await getPayload({ config });
    const otp = (await payload.findByID({
      collection: 'otpRequests',
      id: parsed.data.requestId,
    })) as
      | {
          id: string;
          phone: string;
          codeHash: string;
          attempts: number;
          expiresAt: string;
          consumedAt: string | null;
        }
      | null;

    if (!otp) throw new ApiError(ErrorCode.OTP_EXPIRED, 'OTP not found or expired');
    if (otp.consumedAt) throw new ApiError(ErrorCode.OTP_INVALID, 'OTP already used');
    if (new Date(otp.expiresAt) < new Date())
      throw new ApiError(ErrorCode.OTP_EXPIRED, 'OTP expired');

    if ((otp.attempts ?? 0) >= MAX_ATTEMPTS) {
      throw new ApiError(ErrorCode.OTP_INVALID, 'Too many attempts');
    }

    // Test login seam (temporary): when OTP_BYPASS_PHONE (comma-separated
    // list) / OTP_BYPASS_CODE are set, a listed number verifies with the
    // fixed code — the hash compare is skipped but every other rule (fresh
    // unconsumed request, expiry, attempt throttle, consume-on-success,
    // customer upsert) is enforced, so testers exercise the real flow.
    // Unset the env vars to delete the seam.
    const bypassCode = process.env.OTP_BYPASS_CODE;
    const bypassMatch = Boolean(
      bypassCode && isBypassPhone(otp.phone) && parsed.data.code === bypassCode,
    );

    const ok = bypassMatch || (await argon2.verify(otp.codeHash, parsed.data.code));
    // Increment attempts regardless of result to throttle brute force.
    await payload.update({
      collection: 'otpRequests',
      id: otp.id,
      data: { attempts: (otp.attempts ?? 0) + 1 },
    });
    if (!ok) {
      const left = Math.max(0, MAX_ATTEMPTS - (otp.attempts ?? 0) - 1);
      throw new ApiError(ErrorCode.OTP_INVALID, `Wrong code. ${left} attempts left`);
    }

    await payload.update({
      collection: 'otpRequests',
      id: otp.id,
      data: { consumedAt: new Date().toISOString() },
    });

    // Upsert customer by phone.
    const existing = (await payload.find({
      collection: 'customers',
      where: { phone: { equals: otp.phone } },
      limit: 1,
    })) as unknown as { docs: Array<{ id: string; phone: string; name?: string; email?: string; locale?: string }> };

    let customer = existing.docs[0];
    if (!customer) {
      customer = (await payload.create({
        collection: 'customers',
        data: { phone: otp.phone, locale: 'en' },
      })) as unknown as { id: string; phone: string; name?: string; email?: string; locale?: string };
    }

    const accessToken = await container.jwtService.issueAccessToken(customer.id);
    const refreshToken = await container.jwtService.issueRefreshToken(customer.id);

    return jsonResponse(
      {
        accessToken,
        refreshToken,
        customer: {
          id: customer.id,
          phone: customer.phone,
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
