// app/api/mobile/v1/orders/route.ts
// Orders list endpoint — Task 4.6 (Mishran Mobile Apps v1).
//
// Customer-scoped, paginated. Authentication required (requireCustomer).
// Returns the caller's own orders only; the service layer filters by
// customerId from the verified JWT, so a forged customer id in a query
// string has no effect (we never read it).
//
// Path depth: app/api/mobile/v1/orders/ = 5 dirs under app/ -> 6 `../` to root.
//
// Brief fixes vs task-4.6-brief.md:
//  1. NaN guards: Number('abc') yields NaN; fall back to defaults so
//     `?page=foo` does not crash the route or pass NaN into Payload.
//  2. page lower bound: Math.max(1, ...) prevents page=0 or negative from
//     producing a negative offset inside Payload.
import { NextRequest } from 'next/server';
import { requireCustomer } from '../../../../../lib/api/authMiddleware';
import { jsonResponse, errorResponse } from '../../../../../lib/api/response';
import { PayloadOrderService } from '../../../../../lib/commerce/impl/PayloadOrderService';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function resolvePositiveInt(
  raw: string | null,
  fallback: number,
  max?: number,
): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  const positive = Math.max(1, int);
  return max !== undefined ? Math.min(positive, max) : positive;
}

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const { customerId } = await requireCustomer(req);
    const url = new URL(req.url);
    const page = resolvePositiveInt(url.searchParams.get('page'), DEFAULT_PAGE);
    const pageSize = resolvePositiveInt(
      url.searchParams.get('pageSize'),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );
    const svc = new PayloadOrderService();
    const { items, total } = await svc.listForCustomer(customerId, page, pageSize);
    return jsonResponse({ items, total, page, pageSize }, {
      headers: { 'X-Request-Id': traceId },
    });
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
