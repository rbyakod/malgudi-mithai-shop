import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';

// Media URLs come back ABSOLUTE (task #57): the serializer prefixes
// NEXT_PUBLIC_SITE_URL, defaulting to localhost — mirror it rather than
// hard-coding so the test holds wherever it runs.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Path depth: app/api/mobile/v1/catalog/products/ = 6 dirs -> 6 ../ to root.
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

  function applyFilters(where: any) {
    if (!where) return ALL;
    let filtered = ALL;
    if (where.family && where.family.equals)
      filtered = filtered.filter(function (p) { return p.family === where.family.equals; });
    if (where.freshnessStatus && where.freshnessStatus.equals)
      filtered = filtered.filter(function (p) { return p.freshnessStatus === where.freshnessStatus.equals; });
    if (where.dietaryTags && where.dietaryTags.in) {
      const wanted: string[] = where.dietaryTags.in;
      filtered = filtered.filter(function (p) {
        return wanted.every(function (d) { return p.dietaryTags.indexOf(d) !== -1; });
      });
    }
    if (where.name && where.name.contains)
      filtered = filtered.filter(function (p) { return p.name.indexOf(where.name.contains) !== -1; });
    return filtered;
  }

  const find = vi.fn(async function (args: any) {
    const where = args && args.where;
    const page = (args && args.page) || 1;
    const limit = (args && args.limit) || 50;
    const filtered = applyFilters(where);
    const start = (page - 1) * limit;
    const docs = filtered.slice(start, start + limit);
    return {
      docs: docs,
      totalDocs: filtered.length,
      page: page,
      limit: limit,
      totalPages: 1,
    };
  });

  const payloadStub = { find: find };
  const getPayload = vi.fn(async function () { return payloadStub; });
  return { getPayload: getPayload };
});

// Stub payload.config so its heavy import graph is not evaluated in unit test.
vi.mock('../../../../../../payload.config', () => ({ default: {} }));

import { GET } from './route';

function etagFor(docs: Array<{ id: string; updatedAt: string }>) {
  const input = docs.map(function (d) { return d.id + ':' + (d.updatedAt || ''); }).join('|');
  return '"' + createHash('sha1').update(input).digest('hex').slice(0, 16) + '"';
}

describe('GET /catalog/products', () => {
  it('returns 200 with product list + ETag', async () => {
    const req = new Request('http://localhost/api/mobile/v1/catalog/products');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBeTruthy();
    const body = await res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.total).toBe(2);
    expect(body.data.items[0]).toMatchObject({ id: 'p1', slug: 'kaju-katli' });
    expect(body.data.items[0].images).toEqual([`${SITE}/kaju.jpg`]);
  });

  it('returns 304 when If-None-Match matches', async () => {
    const req1 = new Request('http://localhost/api/mobile/v1/catalog/products');
    const res1 = await GET(req1 as any);
    const etag = res1.headers.get('ETag');
    expect(etag).toBeTruthy();
    // Sanity: ETag matches the documented algorithm.
    expect(etag).toBe(
      etagFor([
        { id: 'p1', updatedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'p2', updatedAt: '2026-01-02T00:00:00.000Z' },
      ]),
    );
    const req2 = new Request('http://localhost/api/mobile/v1/catalog/products', {
      headers: { 'If-None-Match': etag as string },
    });
    const res2 = await GET(req2 as any);
    expect(res2.status).toBe(304);
    expect(res2.headers.get('ETag')).toBe(etag);
  });

  it('filters by family=sugar-free', async () => {
    const req = new Request('http://localhost/api/mobile/v1/catalog/products?family=sugar-free');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.length).toBe(1);
    expect(body.data.items.every((p: any) => p.family === 'sugar-free')).toBe(true);
  });
});
