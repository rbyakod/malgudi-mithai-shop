// app/api/mobile/v1/account/loyalty/route.ts
// Loyalty state read — conversion batch, Batch A (A3).
//
// GET returns the customer's loyalty standing WITHOUT minting anything:
//   { deliveredCount, tier, silverAtDelivered, goldAtDelivered }
//
// tier is null below Silver (2 delivered orders), "silver" at >=2, "gold"
// at >=5 — resolved by the shared tierForDeliveredCount used by the
// wallet-pass route. Unlike /account/loyalty-pass this never 404s below
// the threshold and never touches WalletPasses (web shows progress, iOS
// keeps owning the .pkpass surface).
//
// The delivered-order count query mirrors loyalty-pass exactly
// (customerId + status equals, limit: 0 for the count only).
//
// Path depth: app/api/mobile/v1/account/loyalty/ = 6 `../` to repo root
// (same as the loyalty-pass sibling).
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import {
  tierForDeliveredCount,
  LOYALTY_SILVER_MIN_DELIVERED,
  LOYALTY_GOLD_MIN_DELIVERED,
} from '../../../../../../lib/loyalty/eligibility';

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const payload = await getPayload({ config });

    // Same count the loyalty-pass route performs — delivered orders only.
    const delivered = await payload.find({
      collection: 'orders',
      where: {
        and: [{ customerId: { equals: customerId } }, { status: { equals: 'delivered' } }],
      },
      limit: 0,
    });
    const deliveredCount = delivered.totalDocs ?? 0;

    return jsonResponse(
      {
        deliveredCount,
        tier: tierForDeliveredCount(deliveredCount),
        silverAtDelivered: LOYALTY_SILVER_MIN_DELIVERED,
        goldAtDelivered: LOYALTY_GOLD_MIN_DELIVERED,
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
