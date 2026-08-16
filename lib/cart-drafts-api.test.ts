// lib/cart-drafts-api.test.ts
// Cart-draft upsert + restore handlers (A5). Payload + container mocked —
// no HTTP, no Mongo (mirrors the drafts/route-test mocking style).
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { stores, jwtVerify, rateCheck } = vi.hoisted(() => ({
  stores: { 'cart-drafts': new Map<string, Record<string, unknown>>() },
  jwtVerify: vi.fn(),
  rateCheck: vi.fn(async () => {}),
}));

vi.mock('@/lib/payload-client', () => ({
  getPayload: vi.fn(async () => ({
    find: vi.fn(
      async ({
        where,
      }: {
        where?: Record<string, unknown>;
      }) => {
        const all = Array.from(stores['cart-drafts'].values());
        const sessionId = (where?.sessionId as { equals?: string } | undefined)?.equals;
        const docs = sessionId ? all.filter((d) => d.sessionId === sessionId) : all;
        return { docs, totalDocs: docs.length };
      },
    ),
    create: vi.fn(
      async ({ data }: { data: Record<string, unknown> }) => {
        const id = `cd-${stores['cart-drafts'].size + 1}`;
        const doc = { id, ...data, createdAt: new Date().toISOString() };
        stores['cart-drafts'].set(id, doc);
        return doc;
      },
    ),
    update: vi.fn(
      async ({
        id,
        data,
      }: {
        id: string;
        data: Record<string, unknown>;
      }) => {
        const doc = stores['cart-drafts'].get(id);
        if (!doc) throw new Error('missing');
        const merged = { ...doc, ...data, updatedAt: new Date().toISOString() };
        stores['cart-drafts'].set(id, merged);
        return merged;
      },
    ),
  })),
}));

vi.mock('@/lib/container', () => ({
  container: {
    jwtService: { verify: jwtVerify },
    rateLimiter: { check: rateCheck },
  },
}));

import { handleCartDraftPost, handleCartDraftGet } from './cart-drafts-api';

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/cart-drafts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function getReq(sessionId: string): Request {
  return new Request(`http://test/api/cart-drafts/${sessionId}`);
}

function storedBySession(sessionId: string): Record<string, unknown> | undefined {
  return Array.from(stores['cart-drafts'].values()).find((d) => d.sessionId === sessionId);
}

const ITEMS = [
  { id: 'p1', name: 'Kaju Katli', priceLabel: '₹920 / 250g', quantity: 2, image: '/img.jpg' },
];

describe('POST /api/cart-drafts (handleCartDraftPost)', () => {
  beforeEach(() => {
    stores['cart-drafts'].clear();
    jwtVerify.mockReset();
    rateCheck.mockReset();
    rateCheck.mockResolvedValue(undefined);
  });

  it('creates a draft with 201 and active defaults (anonymous)', async () => {
    const res = await handleCartDraftPost(
      postReq({ sessionId: 'sess-1', items: ITEMS }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionId).toBe('sess-1');
    expect(body.status).toBe('active');
    expect(body.expiresAt).toBeTruthy();

    const doc = storedBySession('sess-1')!;
    expect(doc.items).toEqual(ITEMS);
    expect(doc.status).toBe('active');
    expect(doc.marketingConsent).toBe(false);
    expect(doc.customerId).toBeNull();
    expect(doc.lastActivityAt).toBeTruthy();
    // 30-day TTL.
    expect(Date.parse(doc.expiresAt as string)).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it('upserts by sessionId: second POST updates (200) without duplicating rows', async () => {
    await handleCartDraftPost(postReq({ sessionId: 'sess-1', items: ITEMS }));
    const res = await handleCartDraftPost(
      postReq({ sessionId: 'sess-1', items: [ITEMS[0]!] }),
    );
    expect(res.status).toBe(200);
    expect(stores['cart-drafts'].size).toBe(1);
    expect(storedBySession('sess-1')!.items).toEqual([ITEMS[0]!]);
  });

  it('partial POST: email + consent never wipes items; items survive', async () => {
    await handleCartDraftPost(postReq({ sessionId: 'sess-1', items: ITEMS }));
    const res = await handleCartDraftPost(
      postReq({ sessionId: 'sess-1', email: 'a@b.com', marketingConsent: true }),
    );
    expect(res.status).toBe(200);
    const doc = storedBySession('sess-1')!;
    expect(doc.email).toBe('a@b.com');
    expect(doc.marketingConsent).toBe(true);
    expect(doc.items).toEqual(ITEMS);
  });

  it('marks a draft converted when checkout succeeds', async () => {
    await handleCartDraftPost(postReq({ sessionId: 'sess-1', items: ITEMS }));
    const res = await handleCartDraftPost(postReq({ sessionId: 'sess-1', status: 'converted' }));
    expect(res.status).toBe(200);
    expect(res.json()).resolves.toMatchObject({ status: 'converted' });
    expect(storedBySession('sess-1')!.status).toBe('converted');
  });

  it('stamps customerId for a valid bearer (best-effort)', async () => {
    jwtVerify.mockResolvedValue({ customerId: 'cust-9', jti: 'j' });
    await handleCartDraftPost(
      postReq({ sessionId: 'sess-1' }, { authorization: 'Bearer good-token' }),
    );
    expect(storedBySession('sess-1')!.customerId).toBe('cust-9');
  });

  it('never 401s: an invalid bearer is silently ignored', async () => {
    jwtVerify.mockRejectedValue(new Error('bad token'));
    const res = await handleCartDraftPost(
      postReq({ sessionId: 'sess-1' }, { authorization: 'Bearer stale-token' }),
    );
    expect(res.status).toBe(201);
    expect(storedBySession('sess-1')!.customerId).toBeNull();
  });

  it('returns 429 when the rate limiter rejects', async () => {
    const { ApiError } = await import('./api/errors');
    rateCheck.mockRejectedValue(new ApiError('RATE_LIMITED', 'too many'));
    const res = await handleCartDraftPost(postReq({ sessionId: 'sess-1' }));
    expect(res.status).toBe(429);
    expect(stores['cart-drafts'].size).toBe(0);
  });

  it('proceeds when the rate limiter is unreachable (resilient fire-and-forget)', async () => {
    rateCheck.mockRejectedValue(new Error('mongo down'));
    const res = await handleCartDraftPost(postReq({ sessionId: 'sess-1', items: ITEMS }));
    expect(res.status).toBe(201);
  });

  it('rejects a malformed body with 400 (bad email / missing sessionId)', async () => {
    const missing = await handleCartDraftPost(postReq({ items: ITEMS }));
    expect(missing.status).toBe(400);

    const badEmail = await handleCartDraftPost(
      postReq({ sessionId: 'sess-1', email: 'not-an-email' }),
    );
    expect(badEmail.status).toBe(400);

    const badStatus = await handleCartDraftPost(
      postReq({ sessionId: 'sess-1', status: 'deleted' }),
    );
    expect(badStatus.status).toBe(400);
    expect(stores['cart-drafts'].size).toBe(0);
  });
});

describe('GET /api/cart-drafts/[sessionId] (handleCartDraftGet)', () => {
  beforeEach(() => {
    stores['cart-drafts'].clear();
    jwtVerify.mockReset();
    rateCheck.mockReset();
    rateCheck.mockResolvedValue(undefined);
  });

  async function seed(over: Record<string, unknown> = {}) {
    await handleCartDraftPost(
      postReq({
        sessionId: 'sess-1',
        items: ITEMS,
        estimate: { subtotalInPaise: 184000, itemCount: 2, tier: 'shelf' },
        email: 'shopper@example.com',
        marketingConsent: true,
      }),
    );
    const doc = storedBySession('sess-1')!;
    Object.assign(doc, over);
    stores['cart-drafts'].set(doc.id as string, doc);
  }

  it('returns the restore payload and omits email + customerId', async () => {
    await seed();
    const res = await handleCartDraftGet(getReq('sess-1'), {
      params: Promise.resolve({ sessionId: 'sess-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe('sess-1');
    expect(body.items).toEqual(ITEMS);
    expect(body.estimate).toEqual({ subtotalInPaise: 184000, itemCount: 2, tier: 'shelf' });
    expect(body.status).toBe('active');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('customerId');
  });

  it('404s for an unknown sessionId', async () => {
    const res = await handleCartDraftGet(getReq('nope'), {
      params: Promise.resolve({ sessionId: 'nope' }),
    });
    expect(res.status).toBe(404);
  });

  it('410s for an expired draft (TTL race guard)', async () => {
    await seed({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    const res = await handleCartDraftGet(getReq('sess-1'), {
      params: Promise.resolve({ sessionId: 'sess-1' }),
    });
    expect(res.status).toBe(410);
  });
});
