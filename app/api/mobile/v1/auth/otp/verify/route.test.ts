import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/auth/otp/verify/ = 7 dirs deep -> 7 ../ to repo root.

// Use vi.hoisted so the mock factories can reference shared state without
// tripping the "Cannot access before initialization" TDZ from vi.mock's
// top-level hoisting.
const { argon2Mock, otpStore, customerStore } = vi.hoisted(() => ({
  argon2Mock: {
    hash: vi.fn().mockResolvedValue('hashed-code'),
    verify: vi.fn().mockResolvedValue(true),
    argon2id: 'argon2id' as const,
  },
  otpStore: new Map<string, any>(), // eslint-disable-line @typescript-eslint/no-explicit-any
  customerStore: new Map<string, any>(), // eslint-disable-line @typescript-eslint/no-explicit-any
}));

vi.mock('../../../../../../../lib/container', () => ({
  container: {
    jwtService: {
      issueAccessToken: vi.fn().mockResolvedValue('access-token'),
      issueRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
    },
  },
}));

vi.mock('argon2', () => ({ default: argon2Mock }));

vi.mock('payload', () => ({
  getPayload: vi.fn().mockResolvedValue({
    findByID: vi.fn(async ({ id }: { id: string }) => otpStore.get(id) ?? null),
    update: vi.fn(async ({ id, data }: { id: string; data: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const cur = otpStore.get(id) ?? {};
      const merged = { ...cur, ...data };
      otpStore.set(id, merged);
      return merged;
    }),
    find: vi.fn(async ({ where }: { where?: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Very small filter: support { phone: { equals: x } }
      const phone = where?.phone?.equals;
      for (const c of customerStore.values()) {
        if (c.phone === phone) return { docs: [c], totalDocs: 1 };
      }
      return { docs: [], totalDocs: 0 };
    }),
    create: vi.fn(async ({ collection, data }: { collection: string; data: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (collection === 'customers') {
        const id = `cust-${customerStore.size + 1}`;
        const rec = { id, ...data };
        customerStore.set(id, rec);
        return rec;
      }
      return { id: 'unknown' };
    }),
  }),
}));

vi.mock('../../../../../../../payload.config', () => ({ default: {} }));
vi.mock('../../../../../../../lib/observability/Logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST as verifyHandler } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/mobile/v1/auth/otp/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('POST /auth/otp/verify', () => {
  beforeEach(() => {
    otpStore.clear();
    customerStore.clear();
    argon2Mock.verify.mockReset();
    argon2Mock.verify.mockResolvedValue(true);
  });

  it('returns tokens and customer on valid OTP', async () => {
    otpStore.set('otp-1', {
      id: 'otp-1',
      phone: '+919999999999',
      codeHash: 'hashed-code',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumedAt: null,
    });

    const res = await verifyHandler(makeReq({ requestId: 'otp-1', code: '123456' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBe('access-token');
    expect(body.data.refreshToken).toBe('refresh-token');
    expect(body.data.customer.phone).toBe('+919999999999');
    // Marked consumed
    expect(otpStore.get('otp-1').consumedAt).toBeTruthy();
  });

  it('rejects wrong code with 400 OTP_INVALID', async () => {
    otpStore.set('otp-2', {
      id: 'otp-2',
      phone: '+919999999999',
      codeHash: 'hashed-code',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumedAt: null,
    });
    argon2Mock.verify.mockResolvedValue(false);

    const res = await verifyHandler(makeReq({ requestId: 'otp-2', code: '000000' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('OTP_INVALID');
  });

  it('rejects expired OTP with 410 OTP_EXPIRED', async () => {
    otpStore.set('otp-3', {
      id: 'otp-3',
      phone: '+919999999999',
      codeHash: 'hashed-code',
      attempts: 0,
      expiresAt: new Date(Date.now() - 60_000).toISOString(), // past
      consumedAt: null,
    });

    const res = await verifyHandler(makeReq({ requestId: 'otp-3', code: '123456' }));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe('OTP_EXPIRED');
  });
});
