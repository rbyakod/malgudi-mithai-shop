// TEMPORARY type probe — deleted before finishing.
import { getPayload } from 'payload';
import config from './payload.config';

export type MediaRef = { url?: string | null; alt?: string | null } | string | number | null;
export type ImageRow = { image?: MediaRef } | MediaRef;

export type MithaiProductDoc = {
  id: string | number;
  slug?: string | null;
  name: string;
  images?: ImageRow[];
  updatedAt?: string | null;
};

export async function probe() {
  const payload = await getPayload({ config });
  const mithai = await payload.find({ collection: 'mithai-products', limit: 1 });

  // 1. etag line without any annotation
  const etagInput = mithai.docs.map((d) => `${d.id}:${d.updatedAt ?? ''}`).join('|');

  // 2. findGlobal without cast
  const hero = await payload.findGlobal({ slug: 'home-hero' });
  const autoplay = hero?.autoplayMs;

  // 3. direct array cast (single as)
  const docs1 = mithai.docs as MithaiProductDoc[];
  const docs2 = mithai.docs as unknown as MithaiProductDoc[];

  // 4. findGlobal param extraction
  const hero2 = await payload.findGlobal({ slug: 'home-hero' } as Parameters<typeof payload.findGlobal>[0]);

  return { etagInput, autoplay, docs1, docs2, hero2 };
}
