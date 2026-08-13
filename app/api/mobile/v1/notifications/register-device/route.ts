// app/api/mobile/v1/notifications/register-device/route.ts
// Device registration (push-token upsert) — Task 5.3 (Mishran Mobile Apps v1).
//
// Mobile clients call this on every cold start and on FCM/APNs token refresh
// so the backend can fan order-lifecycle pushes out to the right device
// (OrderEventEmitter, Task 5.2). Idempotent: if the pushToken already exists
// we rebind it to the current customer and reactivate it; otherwise we create
// a row. Because Devices.pushToken is unique, a customer logging out and
// another logging in on the same physical device rebinds cleanly here.
//
// Path depth: app/api/mobile/v1/notifications/register-device/ = 5 dirs under
// app/ -> 6 `../` to repo root.
//
// Brief fix: the brief returned a bare `{ error: 'invalid' }` on bad input.
// Replaced with ApiError(VALIDATION) so the response matches the shared error
// envelope and carries fieldErrors + traceId.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

const Body = z.object({
  platform: z.enum(['android', 'ios']),
  pushToken: z.string().min(1),
  // ActivityKit push token (Task 18.3 iOS): present only while a delivery
  // Live Activity is in flight; OrderEventEmitter fires .liveactivity
  // content-state updates at it (Task 18.4 backend half).
  liveActivityToken: z.string().min(1).optional(),
  appVersion: z.string().optional(),
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  locale: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid register-device body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }

    const payload = await getPayload({ config });
    const existing = await payload.find({
      collection: 'devices',
      where: { pushToken: { equals: parsed.data.pushToken } },
      limit: 1,
    });
    const doc = existing.docs[0] as { id: string } | undefined;

    if (doc) {
      // Rebind + reactivate. Spreading parsed.data refreshes platform/version
      // fields in case the OS/app changed since the last registration.
      await payload.update({
        collection: 'devices',
        id: doc.id,
        data: { customerId, active: true, ...parsed.data },
      });
    } else {
      await payload.create({
        collection: 'devices',
        data: { customerId, active: true, ...parsed.data },
      });
    }

    return jsonResponse({ ok: true }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
