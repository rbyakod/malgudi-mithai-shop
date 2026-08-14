import { NextRequest } from 'next/server';
import { container } from '../container';
import { ApiError, ErrorCode } from './errors';

export async function requireCustomer(req: NextRequest): Promise<{ customerId: string; jti?: string }> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Missing token');
  try {
    const claims = await container.jwtService.verify(auth.slice(7), 'access');
    return { customerId: claims.customerId, jti: claims.jti };
  } catch {
    throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Invalid or expired token');
  }
}
