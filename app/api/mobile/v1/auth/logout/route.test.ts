import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/auth/logout/ = 6 dirs deep -> 6 ../ to repo root.
const { verifyMock, revokeMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  revokeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../../../lib/container', () => ({
  container: {
    jwtService: {
      verify: verifyMock,
      revoke: revokeMock,
    },
  },
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));
vi.mock('../../../../../../lib/observability/Logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST as logoutHandler } from './route';

function makeReq(authToken?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authToken) headers['authorization'] = `Bearer ${authToken}`;
  return new Request('http://localhost/api/mobile/v1/auth/logout', {
    method: 'POST',
    headers,
  }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('POST /auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeMock.mockResolvedValue(undefined);
  });

  it('returns ok:true and revokes token', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3000;
    verifyMock.mockResolvedValue({ customerId: 'c1', jti: 'j1', exp: futureExp, kind: 'refresh' });

    const res = await logoutHandler(makeReq('rt-valid'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ok).toBe(true);
    expect(revokeMock).toHaveBeenCalledWith('j1', 'c1', 'logout', expect.any(Date));
  });

  it('returns ok:true even when verify throws (idempotent)', async () => {
    verifyMock.mockRejectedValue(new Error('already revoked'));

    const res = await logoutHandler(makeReq('rt-expired'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ok).toBe(true);
    // Revoke was never called because verify failed.
    expect(revokeMock).not.toHaveBeenCalled();
  });
});
