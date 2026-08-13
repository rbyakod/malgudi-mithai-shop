import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireCustomer } from './authMiddleware';
import { ApiError } from './errors';
import { container } from '../container';

vi.mock('../container', () => ({
  container: {
    jwtService: {
      verify: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireCustomer', () => {
  it('returns customerId and jti for a valid bearer token', async () => {
    vi.mocked(container.jwtService.verify).mockResolvedValue({
      customerId: 'c1',
      jti: 'j1',
      kind: 'access',
    });

    const req = new Request('http://x', {
      headers: { authorization: 'Bearer tok' },
    }) as unknown as import('next/server').NextRequest;

    const result = await requireCustomer(req);
    expect(result).toEqual({ customerId: 'c1', jti: 'j1' });
    expect(container.jwtService.verify).toHaveBeenCalledWith('tok', 'access');
  });

  it('throws TOKEN_EXPIRED (401) when authorization header is missing', async () => {
    const req = new Request('http://x') as unknown as import('next/server').NextRequest;

    await expect(requireCustomer(req)).rejects.toThrow(ApiError);
    await expect(requireCustomer(req)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
      statusCode: 401,
    });
  });
});
