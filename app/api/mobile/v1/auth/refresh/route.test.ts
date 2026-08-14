import { describe, it, expect, vi, beforeEach } from 'vitest';

// Path depth: app/api/mobile/v1/auth/refresh/ = 6 dirs deep -> 6 ../ to repo root.
const { verifyMock, revokeMock, issueAccessMock, issueRefreshMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  revokeMock: vi.fn().mockResolvedValue(undefined),
  issueAccessMock: vi.fn().mockResolvedValue('at-new'),
  issueRefreshMock: vi.fn().mockResolvedValue('rt-new'),
}));

vi.mock('../../../../../../lib/container', () => ({
  container: {
    jwtService: {
      verify: verifyMock,
      revoke: revokeMock,
      issueAccessToken: issueAccessMock,
      issueRefreshToken: issueRefreshMock,
    },
  },
}));

vi.mock('../../../../../../payload.config', () => ({ default: {} }));
vi.mock('../../../../../../lib/observability/Logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST as refreshHandler } from './route';

function makeReq(authToken?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authToken) headers['authorization'] = `Bearer ${authToken}`;
  return new Request('http://localhost/api/mobile/v1/auth/refresh', {
    method: 'POST',
    headers,
  }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('POST /auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeMock.mockResolvedValue(undefined);
    issueAccessMock.mockResolvedValue('at-new');
    issueRefreshMock.mockResolvedValue('rt-new');
  });

  it('returns new token pair on valid refresh token', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3000;
    verifyMock.mockResolvedValue({ customerId: 'c1', jti: 'j1', exp: futureExp, kind: 'refresh' });

    const res = await refreshHandler(makeReq('rt-old'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBe('at-new');
    expect(body.data.refreshToken).toBe('rt-new');
    // Old token was revoked.
    expect(revokeMock).toHaveBeenCalledWith('j1', 'c1', 'rotation', expect.any(Date));
  });

  it('returns 401 TOKEN_EXPIRED when auth header missing', async () => {
    const res = await refreshHandler(makeReq(undefined));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 401 TOKEN_REVOKED when verify throws', async () => {
    verifyMock.mockRejectedValue(new Error('token revoked'));

    const res = await refreshHandler(makeReq('rt-revoked'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TOKEN_REVOKED');
  });
});
