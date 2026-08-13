// app/api/mobile/v1/addresses/[id]/route.ts
// Address detail: GET / PATCH / DELETE — Task 5.3 (Mishran Mobile Apps v1).
//
// Ownership-gated: every method loads the row first and returns 404 if it
// does not belong to the caller's customerId. The 404 (not 403) avoids
// leaking whether an address id exists for another customer (IDOR defense).
//
// Next.js 15 dynamic params are async: `params: Promise<{ id: string }>`.
//
// Path depth: app/api/mobile/v1/addresses/[id]/ = 5 dirs under app/ -> 6 `../`.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { requireCustomer } from '../../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';
import { clearDefaultAddress } from '../../../../../../lib/addresses/defaultInvariant';

const PatchBody = z.object({
  line1: z.string().min(1).optional(),
  line2: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pincode: z.string().min(1).max(10).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  tag: z.enum(['home', 'work', 'other']).optional(),
  isDefault: z.boolean().optional(),
});

// Load an address and verify it belongs to the caller. Returns null when
// missing OR owned by someone else (both surface as the same 404 upstream).
async function loadOwned(
  payload: Awaited<ReturnType<typeof getPayload>>,
  id: string,
  customerId: string,
): Promise<{ id: string } | null> {
  let doc: { id: string; customerId: string | { id?: string } };
  try {
    doc = (await payload.findByID({ collection: 'addresses', id })) as {
      id: string;
      customerId: string | { id?: string };
    };
  } catch {
    // Payload findByID throws on missing -> treat as not-found-for-customer.
    return null;
  }
  const ownerId =
    typeof doc.customerId === 'object' ? doc.customerId?.id : doc.customerId;
  return String(ownerId) === String(customerId) ? doc : null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const { id } = await ctx.params;
    const payload = await getPayload({ config });
    const doc = await loadOwned(payload, id, customerId);
    if (!doc) throw new ApiError(ErrorCode.NOT_FOUND, 'Address not found');
    return jsonResponse({ address: doc }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const { id } = await ctx.params;
    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid address body', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const payload = await getPayload({ config });
    const doc = await loadOwned(payload, id, customerId);
    if (!doc) throw new ApiError(ErrorCode.NOT_FOUND, 'Address not found');

    if (parsed.data.isDefault) {
      // Preserve `doc.id` so we don't clear the very row we're promoting.
      await clearDefaultAddress(payload, customerId, doc.id);
    }
    const updated = await payload.update({
      collection: 'addresses',
      id,
      data: parsed.data,
    });
    return jsonResponse({ address: updated }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const { id } = await ctx.params;
    const payload = await getPayload({ config });
    const doc = await loadOwned(payload, id, customerId);
    if (!doc) throw new ApiError(ErrorCode.NOT_FOUND, 'Address not found');
    await payload.delete({ collection: 'addresses', id });
    return jsonResponse({ ok: true }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
