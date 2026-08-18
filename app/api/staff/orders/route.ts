// app/api/staff/orders/route.ts
// All-orders console feed — known-gaps campaign B13.
//
// GET /api/staff/orders?page=&pageSize=&status=&paymentMethod=&paymentStatus=
//   &source=&from=&to=&q=
//
// The server route IS the security boundary for the /staff/orders-board
// console: getPayloadAdminUser resolves the Payload session (payload-token
// cookie / Authorization JWT against `users`) and anything else gets 401 —
// a server-component gate can't work for this page because staff auth lives
// in a cookie the client fetches carry for us.
//
// `q` free text: phone-shaped queries are resolved to customer ids first
// (orders carry no denormalized phone); anything else is matched as an
// order id. Phone queries that match no customer short-circuit to an empty
// page rather than building a match-none clause.
//
// Rows expose exactly what the console columns need — id, createdAt, phone,
// name, source, paymentMethod, paymentStatus, status, couponCode, total —
// and nothing else (no addresses, no item dumps).
//
// Path depth: app/api/staff/orders/ = 4 dirs under app/, so 4 `../` to root.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../payload.config';
import { jsonResponse, errorResponse } from '../../../../lib/api/response';
import { ApiError, ErrorCode } from '../../../../lib/api/errors';
import { getPayloadAdminUser } from '../../../../lib/api/adminAuth';
import {
  buildOrdersWhere,
  queryLooksLikePhone,
} from '../../../../lib/admin/ordersBoard';

const Query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: z.string().trim().optional(),
  paymentMethod: z.string().trim().optional(),
  paymentStatus: z.string().trim().optional(),
  source: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const traceId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  try {
    const user = await getPayloadAdminUser(req);
    if (!user) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 'Staff auth required');
    }

    const url = new URL(req.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const parsed = Query.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(ErrorCode.VALIDATION, 'Invalid orders query', {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      });
    }
    const f = parsed.data;
    // Treat empty strings as absent (the console sends selects that clear to '').
    for (const key of ['status', 'paymentMethod', 'paymentStatus', 'source', 'from', 'to', 'q'] as const) {
      if (!f[key]) delete f[key];
    }

    const payload = await getPayload({ config });

    // Phone-shaped q: resolve customers first; no matches -> empty page.
    let phoneCustomerIds: string[] | undefined;
    if (f.q && queryLooksLikePhone(f.q)) {
      const digits = f.q.replace(/[^\d]/g, '');
      const customers = await payload.find({
        collection: 'customers',
        where: { phone: { like: digits } },
        limit: 20,
        depth: 0,
        overrideAccess: true,
      });
      phoneCustomerIds = customers.docs.map((c) => String(c.id));
      if (phoneCustomerIds.length === 0) {
        return jsonResponse(
          { items: [], page: f.page, pageSize: f.pageSize, totalDocs: 0, totalPages: 1 },
          { headers: { 'X-Request-Id': traceId } },
        );
      }
    }

    const result = await payload.find({
      collection: 'orders',
      where: buildOrdersWhere(f, phoneCustomerIds),
      sort: '-createdAt',
      page: f.page,
      limit: f.pageSize,
      // depth 1 populates customerId -> the phone/name columns; the route's
      // field allowlist below keeps the response minimal either way.
      depth: 1,
      overrideAccess: true,
    });

    const items = result.docs.map((doc) => {
      const d = doc as Record<string, unknown>;
      const customer = d.customerId as { id?: string | number; name?: string; phone?: string } | string | undefined;
      return {
        id: String(d.id),
        createdAt: d.createdAt,
        status: d.status,
        paymentStatus: d.paymentStatus,
        paymentMethod: d.paymentMethod ?? 'razorpay',
        source: d.source,
        couponCode: d.couponCode ?? null,
        totalInPaise: (d.totals as { totalInPaise?: number } | undefined)?.totalInPaise ?? null,
        customerName: typeof customer === 'object' && customer ? (customer.name ?? null) : null,
        phone: typeof customer === 'object' && customer ? (customer.phone ?? null) : null,
      };
    });

    return jsonResponse(
      {
        items,
        page: result.page,
        pageSize: result.limit,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
      },
      { headers: { 'X-Request-Id': traceId } },
    );
  } catch (err) {
    return errorResponse(err, traceId);
  }
}
