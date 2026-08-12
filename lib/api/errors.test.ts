import { describe, it, expect } from 'vitest';
import { ApiError, ErrorCode } from './errors';

describe('ApiError', () => {
  it('maps code to status', () => {
    expect(new ApiError(ErrorCode.RATE_LIMITED, 'too many').statusCode).toBe(429);
    expect(new ApiError(ErrorCode.ORDER_NOT_FOUND, 'x').statusCode).toBe(404);
    expect(new ApiError(ErrorCode.TOKEN_EXPIRED, 'x').statusCode).toBe(401);
  });
  it('includes traceId in JSON', () => {
    const e = new ApiError(ErrorCode.INTERNAL, 'oops', { traceId: 'abc' });
    expect(e.toJSON().error.traceId).toBe('abc');
  });
});
