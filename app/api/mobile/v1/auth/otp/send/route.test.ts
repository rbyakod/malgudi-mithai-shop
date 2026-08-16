import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Path depth: app/api/mobile/v1/auth/otp/send/ = 7 dirs deep -> 7 ../ to repo root.

// Hoisted send spy so bypass tests can assert whether the SMS provider path
// ran (vi.mock factories close over this, not over top-level consts).
const { otpSend } = vi.hoisted(() => ({
  otpSend: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
}));

vi.mock('../../../../../../../lib/container', () => ({
  container: {
    otpService: { send: otpSend },
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

function makeReq(phone: string) {
  return new Request('http://localhost/api/mobile/v1/auth/otp/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone }),
  }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('POST /auth/otp/send', () => {
  const ORIGINAL_BYPASS = process.env.OTP_BYPASS_PHONE;

  beforeEach(() => {
    otpSend.mockClear();
    // Default: seam off — the provider path is the baseline.
    delete process.env.OTP_BYPASS_PHONE;
  });

  afterEach(() => {
    // Restore the runner's original env so cases never leak across files.
    if (ORIGINAL_BYPASS === undefined) delete process.env.OTP_BYPASS_PHONE;
    else process.env.OTP_BYPASS_PHONE = ORIGINAL_BYPASS;
  });

  it('returns 200 with requestId on valid phone', async () => {
    const res = await sendHandler(makeReq('+919999999999'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.requestId).toBe('otp-1');
    expect(body.data.expiresAt).toBeTruthy();
    expect(otpSend).toHaveBeenCalledWith('+919999999999', expect.any(String));
  });

  it('rejects invalid phone with 422', async () => {
    const res = await sendHandler(makeReq('bad'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION');
  });

  it('skips the SMS provider when the phone is in the comma-separated bypass list', async () => {
    process.env.OTP_BYPASS_PHONE = '+918088983014,+919812345678';
    const res = await sendHandler(makeReq('+919812345678'));
    expect(res.status).toBe(200);
    expect(otpSend).not.toHaveBeenCalled();
  });

  it('tolerates whitespace around bypass list entries', async () => {
    process.env.OTP_BYPASS_PHONE = ' +918088983014 , +919812345678 ';
    const res = await sendHandler(makeReq('+918088983014'));
    expect(res.status).toBe(200);
    expect(otpSend).not.toHaveBeenCalled();
  });

  it('sends via the provider when the phone is not in the bypass list', async () => {
    process.env.OTP_BYPASS_PHONE = '+918088983014,+919812345678';
    const res = await sendHandler(makeReq('+919999999999'));
    expect(res.status).toBe(200);
    expect(otpSend).toHaveBeenCalledTimes(1);
    expect(otpSend).toHaveBeenCalledWith('+919999999999', expect.any(String));
  });

  it('disables the bypass seam entirely when the env is empty', async () => {
    process.env.OTP_BYPASS_PHONE = '';
    const res = await sendHandler(makeReq('+918088983014'));
    expect(res.status).toBe(200);
    expect(otpSend).toHaveBeenCalledTimes(1);
  });
});
