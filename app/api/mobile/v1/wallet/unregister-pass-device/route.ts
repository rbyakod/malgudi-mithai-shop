// app/api/mobile/v1/wallet/unregister-pass-device/route.ts
// Apple Wallet pass-device deregistration — Task 19.2 (Mishran Mobile Apps v1).
//
// Called by the iOS app when the user removes the loyalty pass from Wallet.
// Drops the device's update token from the WalletPasses.devices[] array so the
// backend stops sending `.pass` update pings to it. Idempotent: removing a
// token that is already absent (or a pass that no longer exists) is a no-op
// 200 — Wallet may call this on its own lifecycle hooks with stale state.
//
// Path depth: app/api/mobile/v1/wallet/unregister-pass-device/ = 5 dirs under
// app/ -> 6 `../` to repo root.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

const Body = z.object({
  serialNumber: z.string().min(1),
  pushToken: z.string().min(1),
});

export async function DELETE(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid unregister-pass-device body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const { serialNumber, pushToken } = parsed.data;

    const payload = await getPayload({ config });

    const found = await payload.find({
      collection: 'walletPasses',
      where: {
        and: [
          { serialNumber: { equals: serialNumber } },
          { customerId: { equals: customerId } },
          { active: { equals: true } },
        ],
      },
      limit: 1,
    });
    const passRow = found.docs[0] as
      | { id: string; devices?: Array<{ pushToken?: string }> }
      | undefined;

    if (passRow) {
      const devices = passRow.devices ?? [];
      const filtered = devices.filter((d) => d.pushToken !== pushToken);
      // Only write when the array actually changes — idempotent no-op otherwise.
      if (filtered.length !== devices.length) {
        await payload.update({
          collection: 'walletPasses',
          id: passRow.id,
          data: { devices: filtered },
        });
      }
    }

    // 200 even when the pass or token is already gone — removal is idempotent.
    return jsonResponse({ ok: true }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
