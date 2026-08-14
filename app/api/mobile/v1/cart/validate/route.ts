import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import { randomUUID } from 'node:crypto';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';

// Cart validate — schema-only implementation.
//
// The brief's original logic referenced four MithaiProducts fields that do
// NOT exist on the collection today: `tier`, `stock`, `priceInPaise`, `unit`.
// The collection has `freshnessStatus` (not tier), no stock, no numeric
// price (only display-only string `displayPrice`), and no unit. Commerce /
// variant pricing is explicitly deferred to Phase 8 per the collection
// header comment. This endpoint therefore:
//   - validates request shape + authn + pincode serviceability,
//   - re-fetches each product to confirm it still exists,
//   - persists a cart snapshot (Task 4.4) so the subsequent create-order
//     route can re-read it server-side rather than trusting a client cart,
//   - returns a stable cart snapshot whose totals are all zero with
//     prominent TODOs pointing at Phase 8.
//
// Mobile clients get a stable contract to integrate against now; real
// pricing, tier-based fulfillment rules, stock checks, and delivery-fee
// computation land together with the commerce schema in Phase 8.

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

    // Re-fetch each product fresh to confirm availability + snapshot metadata.
    // No pricing is computed here — see file header + Phase 8 TODO.
    const items: Array<{
      productId: string;
      slug: string;
      name: string;
      quantity: number;
      freshnessStatus: string | null;
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
          }
        | null;

      if (!product) {
        throw new ApiError(
          ErrorCode.PRODUCT_NOT_FOUND,
          `Product ${it.productId} is no longer available`,
        );
      }

      // TODO Phase 8: enforce fresh→Delhi-NCR-only when a tier field exists.
      // TODO Phase 8: enforce stock >= quantity when a stock field exists.

      items.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        quantity: it.quantity,
        freshnessStatus: product.freshnessStatus ?? null,
      });
    }

    // TODO Phase 8: compute itemsTotal from real variant prices.
    // TODO Phase 8: compute deliveryFee from pincodeTier + itemsTotal.
    // TODO Phase 8: compute taxes (GST estimate) once prices exist.
    const totals = {
      itemsTotalInPaise: 0,
      deliveryFeeInPaise: 0,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 0,
    };

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
        slot: parsed.data.slot,
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
