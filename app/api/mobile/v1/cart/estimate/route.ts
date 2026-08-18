import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { computeTotals } from '../../../../../../lib/commerce/pricing';
import {
  resolvePricedCart,
  freeDeliveryThresholdForTier,
} from '../../../../../../lib/commerce/resolveCart';
import { config as appConfig } from '../../../../../../lib/config';
import { container } from '../../../../../../lib/container';

// Cart estimate — the read-only pricing preview of /cart/validate
// (known-gaps campaign B6). Unauthenticated BY DESIGN: guest carts call
// it to show delivery fees and free-delivery progress before sign-in
// (Android guest browsing, B5) and the apps' cart screens (B9) call it
// on every cart change.
//
// Same pipeline as validate (lib/commerce/resolveCart.ts) but lenient:
//   - no auth — nothing is persisted, no snapshot, no customer data;
//   - an unknown/absent pincode is NOT an error: the tier resolves to
//     null and the fee prices at the shelf rate as an estimate;
//   - the made-daily fresh-tier rule is not enforced here — checkout
//     (validate) enforces it for real.
// Cart integrity stays strict: vanished products (PRODUCT_NOT_FOUND)
// and unpriceable lines (VALIDATION) error exactly like validate, so a
// stale cart reads as stale, not as a wrong estimate.
//
// Abuse guard: per-IP rate limit on the shared Mongo-backed limiter —
// unauthenticated + cheap = the one route in the cart family that needs
// it. 60 estimates/minute/IP is far above any real cart-typing cadence
// (clients debounce) and far below anything that dents the DB.

const Body = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
        // Optional pack-size label from the web PDP's derived selector.
        packLabel: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .max(50),
  // Optional: without it the response carries a null tier/threshold and
  // a zero fee — clients show their "add a pincode for delivery" copy.
  pincode: z.string().regex(/^[0-9]{6}$/).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Behind nginx the client IP is the first x-forwarded-for entry.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await container.rateLimiter.check(`cart:estimate:${ip}`, 60, 60);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid estimate body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }

    const payload = await getPayload({ config });

    const { items, pincodeTier } = await resolvePricedCart(payload, parsed.data.items, {
      pincode: parsed.data.pincode,
      rejectUnserviceable: false,
      enforceFreshTier: false,
    });

    const thresholds = {
      freshPaise: appConfig.freeDeliveryThresholdFreshPaise,
      shelfStablePaise: appConfig.freeDeliveryThresholdShelfStablePaise,
    };
    // A resolved tier prices its real fee. A null tier (no pincode sent,
    // or one we don't serve) has nothing to estimate against — zero fee,
    // null threshold, client shows its no-pincode copy.
    const fees =
      pincodeTier == null
        ? { freshPaise: 0, shelfStablePaise: 0 }
        : {
            freshPaise: appConfig.deliveryFeeFreshPaise,
            shelfStablePaise: appConfig.deliveryFeeShelfStablePaise,
          };
    const totals = computeTotals(items, pincodeTier, fees, thresholds);

    const threshold = freeDeliveryThresholdForTier(pincodeTier, thresholds);
    const freeDeliveryEligible =
      threshold != null && threshold > 0 && totals.itemsTotalInPaise >= threshold;

    return jsonResponse({
      itemsTotalInPaise: totals.itemsTotalInPaise,
      deliveryFeeInPaise: totals.deliveryFeeInPaise,
      discountInPaise: totals.discountInPaise,
      totalInPaise: totals.totalInPaise,
      pincodeTier,
      freeDeliveryThresholdInPaise: threshold,
      freeDeliveryEligible,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
