// app/api/mobile/v1/wallet/register-pass-device/route.ts
// Apple Wallet pass-device registration — Task 19.2 (Mishran Mobile Apps v1).
//
// Called by the iOS app after the user adds the loyalty pass to Wallet via
// PKAddPassesViewController. Wallet issues a per-pass APNs "update" token
// (distinct from the alert + ActivityKit tokens); the app forwards it here so
// the backend can push `.pass` update pings to the right device when the
// customer's loyalty balance / tier changes (OrderEventEmitter, Task 19.2).
//
// Tokens are stored on the WalletPasses row (devices[]), not the Devices
// collection — a single pass may be added to multiple devices. Idempotent: a
// repeat register for an already-known token is a no-op. Ownership is enforced
// by scoping the lookup to the caller's customerId + serialNumber, so a
// foreign serial yields a uniform 404 (no existence leak).
//
// Path depth: app/api/mobile/v1/wallet/register-pass-device/ = 5 dirs under
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

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid register-pass-device body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const { serialNumber, pushToken } = parsed.data;

    const payload = await getPayload({ config });

    // Ownership + existence in one scoped lookup: a foreign serial is simply
    // absent, so the response is a uniform 404 (no existence leak).
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
    if (!passRow) {
      throw new ApiError(
        ErrorCode.NOT_FOUND,
        'No active loyalty pass found for this serial number',
      );
    }

    const devices = passRow.devices ?? [];
    const alreadyRegistered = devices.some((d) => d.pushToken === pushToken);
    if (!alreadyRegistered) {
      // Payload array update is full-replace: send the complete new array.
      await payload.update({
        collection: 'walletPasses',
        id: passRow.id,
        data: { devices: [...devices, { pushToken }] },
      });
    }

    return jsonResponse({ ok: true }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
