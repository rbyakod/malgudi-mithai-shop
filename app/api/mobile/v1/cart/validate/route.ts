import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { flattenImages } from '../../../../../../lib/api/catalogSerializers';
import { resolveLinePrice, computeTotals, normalizeSlot } from '../../../../../../lib/commerce/pricing';
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
//     (subtotal + flat delivery fee by tier from lib/config; taxes are 0
//     — MRP-inclusive GST),
//   - normalizes iOS relative slot tokens ("today"/"morning") so the
//     Orders.slot date field validates downstream.

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

    // Pincode serviceability — same query shape as GET /catalog/serviceable.
    const pincodeDoc = await payload.find({
      collection: 'serviceablePincodes',
      where: { pincode: { equals: parsed.data.pincode }, active: { equals: true } },
      limit: 1,
    });
    if (!pincodeDoc.docs[0]) {
      throw new ApiError(
        ErrorCode.PINCODE_NOT_SERVICEABLE,
        `Cannot deliver to ${parsed.data.pincode}`,
      );
    }
    const pincodeTier = (pincodeDoc.docs[0] as { tier?: string }).tier ?? 'unknown';

    // Re-fetch each product fresh; price it and stamp the snapshot line.
    const items: Array<{
      productId: string;
      slug: string;
      name: string;
      quantity: number;
      freshnessStatus: string | null;
      packLabel: string | null;
      unit: string;
      priceInPaise: number;
      image: string | null;
    }> = [];

    for (const it of parsed.data.items) {
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
      if (product.freshnessStatus === 'made-daily' && pincodeTier !== 'fresh') {
        throw new ApiError(
          ErrorCode.PINCODE_NOT_SERVICEABLE,
          `${product.name} is made daily and only ships on the fresh tier — cannot deliver to ${parsed.data.pincode}`,
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

      items.push({
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

    const totals = computeTotals(
      items,
      pincodeTier,
      {
        freshPaise: appConfig.deliveryFeeFreshPaise,
        shelfStablePaise: appConfig.deliveryFeeShelfStablePaise,
      },
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
      expiresAt,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
