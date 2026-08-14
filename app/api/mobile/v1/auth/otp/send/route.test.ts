import { describe, it, expect, vi } from 'vitest';

// Path depth: app/api/mobile/v1/auth/otp/send/ = 7 dirs deep -> 7 ../ to repo root.
vi.mock('../../../../../../../lib/container', () => ({
  container: {
    otpService: { send: vi.fn().mockResolvedValue({ messageId: 'msg-1' }) },
    rateLimiter: { check: vi.fn().mockResolvedValue(undefined) },
  },
}));

// Mock Payload so the route does not require a running Mongo. vi.mock is
// hoisted, so the factory must not reference outer-scope variables.
vi.mock('payload', () => ({
  getPayload: vi.fn().mockResolvedValue({
    create: vi.fn().mockResolvedValue({ id: 'otp-1' }),
    update: vi.fn().mockResolvedValue({}),
  }),
}));

// Stub payload.config so its heavy import graph (db adapter, plugins, etc.)
// is not evaluated during this unit test.
vi.mock('../../../../../../../payload.config', () => ({ default: {} }));

// Stub Logger so lib/config (env parsing) is not pulled in transitively from
// the route's `import { logger }`.
vi.mock('../../../../../../../lib/observability/Logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock argon2 so we don't actually hash in tests.
vi.mock('argon2', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-code') },
}));

import { POST as sendHandler } from './route';

describe('POST /auth/otp/send', () => {
  it('returns 200 with requestId on valid phone', async () => {
    const req = new Request('http://localhost/api/mobile/v1/auth/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+919999999999' }),
    });
    const res = await sendHandler(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requestId).toBe('otp-1');
    expect(body.data.expiresAt).toBeTruthy();
  });

  it('rejects invalid phone with 422', async () => {
    const req = new Request('http://localhost/api/mobile/v1/auth/otp/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: 'bad' }),
    });
    const res = await sendHandler(req as any);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });
});
