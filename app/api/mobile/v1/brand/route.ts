// app/api/mobile/v1/brand/route.ts
// Brand-level support contact for the apps' "Need help" surfaces.
//
// Deliberately exposes ONLY the WhatsApp fields from the analytics-settings
// global — the raw Payload global also carries ga4Id / metaPixelId /
// hotjarId, which must not leak onto a public endpoint. Missing global or
// empty field falls back to FALLBACK_WHATSAPP (lib/whatsapp.ts), matching
// the web's CommerceStub/SiteFooter behavior. No ETag: single tiny doc,
// fetched once per app launch and cached client-side.
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
// 5 ../ to repo root from app/api/mobile/v1/brand/
import config from '../../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { FALLBACK_WHATSAPP, toWaDigits } from '../../../../../lib/whatsapp';

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const payload = await getPayload({ config });
    const global = await payload.findGlobal({ slug: 'analytics-settings' });
    const raw = (global as { whatsappNumber?: unknown }).whatsappNumber;
    const whatsappNumber =
      typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : FALLBACK_WHATSAPP;
    const whatsappDigits = toWaDigits(whatsappNumber);

    // Display copy for the apps' home masthead / announcement strip, from
    // the same global the web BrandHero reads. Nullable: apps render their
    // localized fallback copy when the admin leaves these unset. As with
    // the analytics global above, only these three display fields cross
    // the wire — logo/defaultTheme and anything else in brand-settings
    // stays server-side.
    const brand = await payload.findGlobal({ slug: 'brand-settings' });
    const brandFields = brand as {
      brandName?: unknown;
      tagline?: unknown;
      positioning?: unknown;
    };
    const copyField = (v: unknown): string | null =>
      typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

    return jsonResponse(
      {
        whatsappNumber,
        whatsappDigits,
        brandName: copyField(brandFields.brandName),
        tagline: copyField(brandFields.tagline),
        positioning: copyField(brandFields.positioning),
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
