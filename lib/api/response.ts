import { NextResponse } from 'next/server';
import { ApiError, ErrorCode } from './errors';

export function jsonResponse(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function errorResponse(err: unknown, traceId: string = 'none') {
  if (err instanceof ApiError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode, headers: { 'X-Request-Id': traceId } });
  }
  // Don't leak internal details.
  const internal = new ApiError(ErrorCode.INTERNAL, 'Something went wrong.', { traceId });
  return NextResponse.json(internal.toJSON(), { status: 500, headers: { 'X-Request-Id': traceId } });
}
