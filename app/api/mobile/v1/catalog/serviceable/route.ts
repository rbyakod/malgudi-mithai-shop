import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';

const Query = z.object({ pincode: z.string().regex(/^[0-9]{6}$/) });

export async function GET(req: NextRequest) {
  try {
    const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return jsonResponse({ serviceable: false, reason: 'invalid_pincode' }, { status: 422 });
    const payload = await getPayload({ config });
    const result = await payload.find({ collection: 'serviceablePincodes', where: { pincode: { equals: parsed.data.pincode }, active: { equals: true } }, limit: 1 });
    if (!result.docs[0]) return jsonResponse({ serviceable: false });
    // serviceablePincodes doc fields echoed back (collections/ServiceablePincodes.ts).
    const p = result.docs[0] as { tier?: string | null; city?: string | null; slaDays?: number | null };
    return jsonResponse({ serviceable: true, tier: p.tier, city: p.city, slaDays: p.slaDays });
  } catch (err) {
    return errorResponse(err);
  }
}
