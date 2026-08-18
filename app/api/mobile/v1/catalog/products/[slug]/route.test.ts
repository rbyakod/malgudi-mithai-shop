// app/api/mobile/v1/catalog/products/[slug]/route.test.ts
import { describe, it, expect, vi } from 'vitest';

// Media URLs come back ABSOLUTE (task #57): the serializer prefixes
// NEXT_PUBLIC_SITE_URL, defaulting to localhost — mirror it rather than
// hard-coding so the test holds wherever it runs.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Path depth: app/api/mobile/v1/catalog/products/[slug]/ = 7 dirs -> 7 ../ to root.
// Mock Payload so the route does not require a running Mongo. vi.mock is
// hoisted, so the factory must not reference outer-scope variables; we
// hard-code the fixture set inside the factory. We avoid arrow-fn-returns-
// object-literal shapes that confused the oxc parser on this file.
vi.mock('payload', () => {
  type Fixture = {
    id: string;
    slug: string;
    name: string;
    family: string;
    displayPrice: string;
    freshnessStatus: string;
    dietaryTags: string[];
    allergens: string[];
    ingredients: string;
    shelfLife: string;
    storage: string;
    images: Array<{ image: { url: string } }>;
    story: string | null;
    karigar: { id: string } | null;
    updatedAt: string;
  };
  const ALL: Fixture[] = [
    {
      id: 'p1',
      slug: 'kaju-katli',
      name: 'Kaju Katli',
      family: 'sugar-free',
      displayPrice: '₹600/250g',
      freshnessStatus: 'made-daily',
      dietaryTags: ['sugar_free'],
      allergens: ['nuts'],
      ingredients: 'Cashew, sugar',
      shelfLife: '10 days',
      storage: 'Cool dry place',
      images: [{ image: { url: '/kaju.jpg' } }],
      story: null,
      karigar: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      slug: 'gulab-jamun',
      name: 'Gulab Jamun',
      family: 'classic',
      displayPrice: '₹400/250g',
      freshnessStatus: 'made-to-order',
      dietaryTags: [],
      allergens: ['milk'],
      ingredients: 'Milk solids, sugar syrup',
      shelfLife: '2 days',
      storage: 'Refrigerate',
      images: [],
      story: null,
      karigar: { id: 'k1' },
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ];

  const find = vi.fn(async function (args: any) {
    const where = args && args.where;
    const slugEq = where && where.slug && where.slug.equals;
    const docs = slugEq ? ALL.filter(function (p) { return p.slug === slugEq; }) : ALL;
    return {
      docs: docs,
      totalDocs: docs.length,
      page: 1,
      limit: args && args.limit ? args.limit : 50,
      totalPages: 1,
    };
  });

  const payloadStub = { find: find };
  const getPayload = vi.fn(async function () { return payloadStub; });
  return { getPayload: getPayload };
});

// Stub payload.config so its heavy import graph is not evaluated in unit test.
vi.mock('../../../../../../../payload.config', () => ({ default: {} }));

import { GET } from './route';

describe('GET /catalog/products/{slug}', () => {
  it('returns 200 with serialized product detail', async () => {
    const req = new Request('http://localhost/api/mobile/v1/catalog/products/kaju-katli');
    const res = await GET(req as any, { params: Promise.resolve({ slug: 'kaju-katli' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.slug).toBe('kaju-katli');
    expect(body.data.id).toBe('p1');
    expect(body.data.name).toBe('Kaju Katli');
    expect(body.data.family).toBe('sugar-free');
    expect(body.data.displayPrice).toBe('₹600/250g');
    expect(body.data.freshnessStatus).toBe('made-daily');
    expect(body.data.dietaryTags).toEqual(['sugar_free']);
    expect(body.data.allergens).toEqual(['nuts']);
    expect(body.data.ingredients).toBe('Cashew, sugar');
    expect(body.data.shelfLife).toBe('10 days');
    expect(body.data.storage).toBe('Cool dry place');
    expect(body.data.images).toEqual([`${SITE}/kaju.jpg`]);
    expect(body.data.story).toBeNull();
    expect(body.data.karigar).toBeNull();
    expect(body.data.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns 404 with PRODUCT_NOT_FOUND when slug is missing', async () => {
    const req = new Request('http://localhost/api/mobile/v1/catalog/products/does-not-exist');
    const res = await GET(req as any, {
      params: Promise.resolve({ slug: 'does-not-exist' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
