import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { computeTotals, normalizeSlot } from '../../../../../../lib/commerce/pricing';
import {
  resolvePricedCart,
  freeDeliveryThresholdForTier,
} from '../../../../../../lib/commerce/resolveCart';
import {
  normalizeCouponCode,
  evaluateCoupon,
  type CouponRule,
} from '../../../../../../lib/commerce/couponValidation';
import { config as appConfig } from '../../../../../../lib/config';

// Cart validate — the pricing boundary of the checkout flow.
//
// The catalog carries exactly ONE real price per product as a display
// string ("₹920 / 250g"); the web PDP additionally sells derived pack
// sizes under cart ids `${productId}:${label}`. This endpoint is the
// pricing truth both clients check out against:
//   - validates request shape + authn + pincode serviceability,
//   - re-fetches each product fresh to confirm it still exists,
//   - prices every line server-side (lib/commerce/pricing.ts — same
//     derivation/rounding as the PDP; optional items[].packLabel selects
//     a derived pack size; unpriceable lines ("on request") are rejected),
//   - enforces the fresh-tier rule: made-daily items only ship on
//     fresh-tier pincodes,
//   - persists a tamper-evident cart snapshot whose items carry
//     unit/priceInPaise/packLabel/image and whose totals are real
//     (subtotal + flat delivery fee by tier from lib/config, waived at or
//     above the tier's free-delivery threshold; taxes are 0 —
//     MRP-inclusive GST),
//   - normalizes iOS relative slot tokens ("today"/"morning") so the
//     Orders.slot date field validates downstream.
//
// The resolve-and-price pipeline lives in lib/commerce/resolveCart.ts,
// shared with the unauthenticated POST /cart/estimate (B6) — this route
// runs it strict (unserviceable pincodes and fresh-tier violations are
// checkout-blocking errors).

const Slot = z.object({
  date: z.string().min(1),
  window: z.string().min(1),
});

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
    .min(1),
  pincode: z.string().regex(/^[0-9]{6}$/),
  slot: Slot.optional(),
  // Coupon code (B7). Resolved against the Coupons collection; an unusable
  // code is a checkout-blocking INVALID_COUPON — never silently ignored,
  // the customer just typed it. Case-insensitive ("diwali10" = "DIWALI10").
  couponCode: z.string().trim().min(1).max(40).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { customerId } = await requireCustomer(req);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid cart body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }

    const payload = await getPayload({ config });

    const { items, pincodeTier } = await resolvePricedCart(payload, parsed.data.items, {
      pincode: parsed.data.pincode,
      rejectUnserviceable: true,
      enforceFreshTier: true,
    });

    // Coupon resolution (B7). The rules live in the Coupons collection;
    // evaluation is the pure lib/commerce/couponValidation module. Validate
    // NEVER burns a code — counters are read here, incremented only by
    // order creation. An unusable code throws INVALID_COUPON; the response
    // carries the applied code so clients can render the chip.
    let discountInPaise = 0;
    let couponCode: string | null = null;
    if (parsed.data.couponCode) {
      couponCode = normalizeCouponCode(parsed.data.couponCode);
      const couponDocs = await payload.find({
        collection: 'coupons',
        where: { code: { equals: couponCode } },
        limit: 1,
      });
      const couponDoc = couponDocs.docs[0] as (CouponRule & { id: string }) | undefined;
      if (!couponDoc) {
        throw new ApiError(
          ErrorCode.INVALID_COUPON,
          `Coupon code "${couponCode}" is not valid`,
        );
      }
      // Per-customer usage counts EVERY order this customer placed with
      // the code (any status) — an abandoned pending_payment order still
      // consumed their shot; cancellations never refund a redemption.
      const usage = await payload.count({
        collection: 'orders',
        where: {
          and: [
            { couponCode: { equals: couponCode } },
            { customerId: { equals: customerId } },
          ],
        },
      });
      const itemsTotalInPaise = items.reduce(
        (sum, it) => sum + it.priceInPaise * it.quantity,
        0,
      );
      const evaluation = evaluateCoupon(
        { ...couponDoc, code: couponCode },
        itemsTotalInPaise,
        { usedTotal: couponDoc.usedCount ?? 0, usedByCustomer: usage.totalDocs },
        new Date(),
      );
      if (!evaluation.ok) {
        throw new ApiError(ErrorCode.INVALID_COUPON, evaluation.message);
      }
      discountInPaise = evaluation.discountInPaise;
    }

    const totals = computeTotals(
      items,
      pincodeTier,
      {
        freshPaise: appConfig.deliveryFeeFreshPaise,
        shelfStablePaise: appConfig.deliveryFeeShelfStablePaise,
      },
      {
        freshPaise: appConfig.freeDeliveryThresholdFreshPaise,
        shelfStablePaise: appConfig.freeDeliveryThresholdShelfStablePaise,
      },
      discountInPaise,
    );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Persist the snapshot (Task 4.4). The doc id becomes the snapshotId
    // handed back to the client and re-presented to /payments/razorpay/
    // create-order. Stamping items/totals/pincode server-side gives the
    // create-order route a tamper-evident cart to work from.
    const snapshotDoc = await payload.create({
      collection: 'snapshots',
      data: {
        customerId,
        items,
        totals,
        pincode: parsed.data.pincode,
        pincodeTier,
        slot: normalizeSlot(parsed.data.slot),
        couponCode,
        expiresAt,
      },
    });
    const snapshotId = String(snapshotDoc.id);

    return jsonResponse({
      snapshotId,
      customerId,
      items,
      totals,
      pincodeTier,
      // Applied coupon (null when none requested/eligible) — create-order
      // re-reads it off the snapshot; clients render the chip from it.
      couponCode,
      // Threshold for the tier, so clients render "₹x more for free
      // delivery" from the server's number, never a baked-in constant.
      freeDeliveryThresholdInPaise: freeDeliveryThresholdForTier(pincodeTier, {
        freshPaise: appConfig.freeDeliveryThresholdFreshPaise,
        shelfStablePaise: appConfig.freeDeliveryThresholdShelfStablePaise,
      }),
      expiresAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
