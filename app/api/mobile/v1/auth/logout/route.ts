import { NextRequest } from 'next/server';
import { container } from '../../../../../../lib/container';
import { jsonResponse, errorResponse } from '../../../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../../../lib/api/errors';

export async function POST(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Missing token');
    const token = auth.slice(7);
    try {
      const claims = await container.jwtService.verify(token, 'refresh');
      if (claims.jti) await container.jwtService.revoke(claims.jti, claims.customerId, 'logout', new Date((claims.exp ?? 0) * 1000));
    } catch { /* already revoked — idempotent */ }
    return jsonResponse({ ok: true }, { headers: { 'X-Request-Id': traceId } });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
