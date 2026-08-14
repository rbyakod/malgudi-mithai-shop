import { NextRequest } from 'next/server';
import { container } from '../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Missing refresh token');
    const refresh = auth.slice(7);
    let claims;
    try {
      claims = await container.jwtService.verify(refresh, 'refresh');
    } catch {
      throw new ApiError(ErrorCode.TOKEN_REVOKED, 'Invalid refresh token');
    }
    // Rotate: revoke old, issue new pair.
    if (claims.jti) {
      await container.jwtService.revoke(claims.jti, claims.customerId, 'rotation', new Date((claims.exp ?? 0) * 1000));
    }
    const accessToken = await container.jwtService.issueAccessToken(claims.customerId);
    const newRefresh = await container.jwtService.issueRefreshToken(claims.customerId);
    return jsonResponse({ accessToken, refreshToken: newRefresh }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
