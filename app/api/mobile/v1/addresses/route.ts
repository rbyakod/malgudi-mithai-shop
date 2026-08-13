// app/api/mobile/v1/addresses/route.ts
// Addresses list + create — Task 5.3 (Mishran Mobile Apps v1).
//
// Customer-scoped CRUD over the `addresses` collection. The verified JWT's
// customerId is the only customerId ever written or read — a forged id in the
// body or query string is ignored (we never trust client-supplied ownership).
//
// isDefault invariant: at most one address per customer may be the default.
// On create (or flip-to-default via PATCH in the [id] route) any prior
// default for that customer is cleared first.
//
// Path depth: app/api/mobile/v1/addresses/ = 4 dirs under app/ -> 5 `../`.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';
import { requireCustomer } from '../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../lib/api/errors';
import { clearDefaultAddress } from '../../../../../lib/addresses/defaultInvariant';

const Body = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1).max(10),
  lat: z.number().optional(),
  lng: z.number().optional(),
  tag: z.enum(['home', 'work', 'other']).optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: 'addresses',
      where: { customerId: { equals: customerId } },
      sort: '-updatedAt',
      limit: 100,
    });
    return jsonResponse({ items: result.docs }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid address body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const payload = await getPayload({ config });

    if (parsed.data.isDefault) {
      await clearDefaultAddress(payload, customerId);
    }

    const created = await payload.create({
      collection: 'addresses',
      data: { customerId, ...parsed.data },
    });
    return jsonResponse({ address: created }, {
      status: 201,
      headers: { 'X-Request-Id': traceId },
    });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
