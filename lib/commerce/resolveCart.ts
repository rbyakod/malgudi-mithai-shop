// lib/commerce/resolveCart.ts
// Shared cart resolution for POST /cart/validate (strict) and
// POST /cart/estimate (informational) — known-gaps campaign B6.
//
// Both endpoints run the SAME pipeline: pincode serviceability lookup,
// fresh product re-fetch, server-side line pricing via resolveLinePrice
// (optional packLabel prices the derived pack). What differs is policy,
// expressed as flags:
//   - validate (checkout boundary): unserviceable pincodes and fresh-tier
//     violations are hard errors — you may not check out to them.
//   - estimate (guest cart preview): both are informational. An unknown
//     pincode prices at the shelf rate with a null tier; made-daily items
//     are priced without complaint (checkout still enforces the rule).
// Cart integrity is always strict: a vanished product (PRODUCT_NOT_FOUND)
// or an unpriceable line (VALIDATION) errors in both, so callers can tell
// "here is your estimate" from "your cart is stale".

import type { Payload } from 'payload';
import { ApiError, ErrorCode } from '../api/errors';
import { flattenImages } from '../api/catalogSerializers';
import { resolveLinePrice } from './pricing';

export type ResolveCartItem = {
  productId: string;
  quantity: number;
  packLabel?: string;
};

export type PricedLine = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  freshnessStatus: string | null;
  packLabel: string | null;
  unit: string;
  priceInPaise: number;
  image: string | null;
};

export type ResolvedCart = {
  items: PricedLine[];
  /** Service tier of the pincode; null when absent/unknown (estimate only). */
  pincodeTier: string | null;
};

export async function resolvePricedCart(
  payload: Payload,
  items: ResolveCartItem[],
  opts: {
    pincode?: string;
    /** Throw PINCODE_NOT_SERVICEABLE on an unknown pincode (validate). */
    rejectUnserviceable: boolean;
    /** Throw when made-daily items meet a non-fresh tier (validate). */
    enforceFreshTier: boolean;
  },
): Promise<ResolvedCart> {
  // Pincode serviceability — same query shape as GET /catalog/serviceable.
  let pincodeTier: string | null = null;
  if (opts.pincode) {
    const pincodeDoc = await payload.find({
      collection: 'serviceablePincodes',
      where: { pincode: { equals: opts.pincode }, active: { equals: true } },
      limit: 1,
    });
    if (!pincodeDoc.docs[0]) {
      if (opts.rejectUnserviceable) {
        throw new ApiError(
          ErrorCode.PINCODE_NOT_SERVICEABLE,
          `Cannot deliver to ${opts.pincode}`,
        );
      }
      pincodeTier = null;
    } else {
      pincodeTier = (pincodeDoc.docs[0] as { tier?: string }).tier ?? 'unknown';
    }
  }

  // Re-fetch each product fresh; price it and stamp the line.
  const priced: PricedLine[] = [];

  for (const it of items) {
    const product = (await payload.findByID({
      collection: 'mithai-products',
      id: it.productId,
      overrideAccess: false,
    })) as
      | {
          id: string;
          slug: string;
          name: string;
          freshnessStatus?: string | null;
          displayPrice?: string | null;
          weight?: string | null;
          images?: unknown;
        }
      | null;

    if (!product) {
      throw new ApiError(
        ErrorCode.PRODUCT_NOT_FOUND,
        `Product ${it.productId} is no longer available`,
      );
    }

    // Fresh-tier rule (F3): made-daily items ship same-city only. Mixed
    // carts are rejected up front with the offending line named.
    if (
      opts.enforceFreshTier &&
      product.freshnessStatus === 'made-daily' &&
      pincodeTier !== 'fresh'
    ) {
      throw new ApiError(
        ErrorCode.PINCODE_NOT_SERVICEABLE,
        `${product.name} is made daily and only ships on the fresh tier — cannot deliver to ${opts.pincode}`,
      );
    }

    const linePrice = resolveLinePrice(product, it.packLabel);
    if (!linePrice) {
      throw new ApiError(
        ErrorCode.VALIDATION,
        `${product.name} is not priced for online ordering${it.packLabel ? ` (pack "${it.packLabel}" is unavailable)` : ''}`,
        { fieldErrors: { productId: product.id } },
      );
    }

    priced.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      quantity: it.quantity,
      freshnessStatus: product.freshnessStatus ?? null,
      packLabel: it.packLabel ?? null,
      unit: linePrice.unit,
      priceInPaise: linePrice.priceInPaise,
      image: flattenImages(product.images)[0] ?? null,
    });
  }

  return { items: priced, pincodeTier };
}

/**
 * The pincode tier's free-delivery threshold in paise (0 disables the
 * waiver; null when the tier is unknown). Exposed so /cart/validate and
 * /cart/estimate return the SAME field clients render threshold progress
 * from — never a baked-in client constant.
 */
export function freeDeliveryThresholdForTier(
  tier: string | null | undefined,
  thresholds: { freshPaise: number; shelfStablePaise: number },
): number | null {
  if (tier === 'fresh') return thresholds.freshPaise;
  if (tier != null) return thresholds.shelfStablePaise;
  return null;
}
