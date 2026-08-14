import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/catalog/serviceable/ = 6 dirs -> 6 ../ to root.
let mockDocs: any[] = [];

vi.mock('payload', () => {
  const find = vi.fn(async function (args: any) {
    return { docs: mockDocs };
  });
  const payloadStub = { find: find };
  const getPayload = vi.fn(async function () { return payloadStub; });
  return { getPayload: getPayload };
});

// Stub payload.config so its heavy import graph is not evaluated in unit test.
vi.mock('../../../../../../payload.config', () => ({ default: {} }));

import { GET } from './route';

describe('GET /catalog/serviceable', () => {
  beforeEach(() => {
    mockDocs = [];
  });

  it('returns 200 with serviceable=true for matching pincode', async () => {
    mockDocs = [{ pincode: '560001', tier: 'shelf', city: 'Bengaluru', slaDays: 3, active: true }];
    const req = new Request('http://localhost/api/mobile/v1/catalog/serviceable?pincode=560001');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.serviceable).toBe(true);
    expect(body.data.tier).toBe('shelf');
    expect(body.data.city).toBe('Bengaluru');
    expect(body.data.slaDays).toBe(3);
  });

  it('returns 200 with serviceable=false for unknown pincode', async () => {
    mockDocs = [];
    const req = new Request('http://localhost/api/mobile/v1/catalog/serviceable?pincode=999999');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.serviceable).toBe(false);
    expect(body.data).not.toHaveProperty('tier');
    expect(body.data).not.toHaveProperty('city');
    expect(body.data).not.toHaveProperty('slaDays');
  });

  it('returns 422 with invalid_pincode reason for non-numeric pincode', async () => {
    const req = new Request('http://localhost/api/mobile/v1/catalog/serviceable?pincode=abc');
    const res = await GET(req as any);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.data.serviceable).toBe(false);
    expect(body.data.reason).toBe('invalid_pincode');
  });
});
