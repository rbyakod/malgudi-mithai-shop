import { describe, it, expect, vi } from 'vitest';

vi.mock('payload', () => {
  const store = new Map();
  return {
    getPayload: vi.fn(async () => ({
      find: vi.fn(async ({ where }) => {
        const key = where?.key?.equals;
        return store.has(key) ? { docs: [store.get(key)] } : { docs: [] };
      }),
      create: vi.fn(async ({ data }) => {
        store.set(data.key, data);
        return data;
      }),
    })),
  };
});

vi.mock('../../payload.config', () => ({ default: {} }));

import { withIdempotency } from './idempotency';
import { getPayload } from 'payload';

describe('withIdempotency', () => {
  it('caches identical request', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('{"data":1}', { status: 200 }));
    const key = 'k1';
    const body = '{"a":1}';
    const r1 = await withIdempotency(key, body, handler);
    const r2 = await withIdempotency(key, body, handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await r2.json()).toEqual({ data: 1 });
  });

  it('rejects different body same key', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await withIdempotency('k2', '{"a":1}', handler);
    const r = await withIdempotency('k2', '{"a":2}', handler);
    expect(r.status).toBe(409);
  });

  it('bypasses cache when key is null', async () => {
    const payload = await getPayload({ config: {} as never });
    const findSpy = payload.find as ReturnType<typeof vi.fn>;
    const handler = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const r = await withIdempotency(null, '{"a":1}', handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(findSpy).not.toHaveBeenCalled();
    expect(r.status).toBe(200);
  });
});
