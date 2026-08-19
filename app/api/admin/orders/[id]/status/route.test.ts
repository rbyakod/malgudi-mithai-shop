// app/api/admin/orders/[id]/status/route.test.ts
// Tests for admin order-status update route — Task 5.1 (Mishran Mobile Apps v1).
//
// Path depth: app/api/admin/orders/[id]/status/ = 6 dirs under app/, so 7 `../`
// to repo root from this file. We mock `payload`, `payload.config`, and the
// admin-auth helper `getPayloadAdminUser`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { stores, adminUser, emitOrderEvent } = vi.hoisted(() => ({
  stores: {
    orders: new Map<string, Record<string, unknown>>(),
    shipments: new Map<string, Record<string, unknown>>(),
  },
  adminUser: vi.fn(),
  emitOrderEvent: vi.fn(),
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: string }) => {
        if (collection !== "orders") return null;
        const doc = stores.orders.get(id);
        if (!doc) {
          // Payload's findByID throws a 404 when the doc is missing;
          // PayloadOrderService converts either outcome to ORDER_NOT_FOUND.
          const err = new Error("not found");
          (err as { statusCode?: number }).statusCode = 404;
          throw err;
        }
        return doc;
      },
    ),
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where: { orderId?: { equals?: string } };
      }) => {
        if (collection !== "shipments") return { docs: [] };
        const orderId = where?.orderId?.equals;
        const doc = orderId
          ? Array.from(stores.shipments.values()).find(
              (d) => d.orderId === orderId,
            )
          : undefined;
        return { docs: doc ? [doc] : [] };
      },
    ),
    update: vi.fn(
      async ({
        collection,
        id,
        data,
      }: {
        collection: string;
        id: string;
        data: Record<string, unknown>;
      }) => {
        if (collection === "orders") {
          const doc = stores.orders.get(id);
          if (!doc) throw new Error("order missing");
          const merged = { ...doc, ...data, updatedAt: new Date().toISOString() };
          stores.orders.set(id, merged);
          return merged;
        }
        if (collection === "shipments") {
          const doc = stores.shipments.get(id);
          if (!doc) throw new Error("shipment missing");
          const merged = { ...doc, ...data };
          stores.shipments.set(id, merged);
          return merged;
        }
        throw new Error(`update: unknown collection ${collection}`);
      },
    ),
  })),
}));

vi.mock("../../../../../../payload.config", () => ({ default: {} }));

// Mock the admin-auth helper (sits next to the route). Returning undefined
// simulates "no admin user on the request". The route MUST treat that as 401.
vi.mock("../../../../../../lib/api/adminAuth", () => ({
  getPayloadAdminUser: adminUser,
}));

// Mock the notification fan-out so the route test stays focused on the
// transition + response. This also breaks the transitive import chain
// (emitter -> container -> Logger -> config) that would otherwise crash on
// the required-env schema.parse in the test environment. The emitter has
// its own dedicated unit tests in lib/notifications/OrderEventEmitter.test.ts.
vi.mock("../../../../../../lib/notifications/OrderEventEmitter", () => ({
  emitOrderEvent,
}));

import { POST } from "./route";

function resetStores() {
  stores.orders.clear();
  stores.shipments.clear();
}

function authedReq(
  id: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(
    `http://localhost/api/admin/orders/${id}/status`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fake-admin-token",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

function unauthedReq(id: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/admin/orders/${id}/status`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

function seedOrder(over: Partial<Record<string, unknown>> = {}) {
  const id = (over.id as string | undefined) ?? "order-1";
  const doc: Record<string, unknown> = {
    id,
    customerId: "cust-1",
    items: [],
    totals: {
      itemsTotalInPaise: 0,
      deliveryFeeInPaise: 0,
      taxesInPaise: 0,
      discountInPaise: 0,
      totalInPaise: 0,
    },
    status: "confirmed",
    paymentStatus: "paid",
    deliveryAddressId: "addr-1",
    source: "mobile-android",
    createdAt: "2026-08-12T10:00:00.000Z",
    updatedAt: "2026-08-12T10:00:00.000Z",
    ...over,
  };
  stores.orders.set(id, doc);
  return doc;
}

describe("POST /api/admin/orders/:id/status", () => {
  beforeEach(() => {
    resetStores();
    adminUser.mockReset();
    adminUser.mockResolvedValue({ id: "admin-1" });
    emitOrderEvent.mockReset();
    emitOrderEvent.mockResolvedValue(undefined);
  });

  it("200 happy path: admin transitions order confirmed -> packed", async () => {
    seedOrder({ id: "order-1", status: "confirmed" });
    const res = await POST(authedReq("order-1", { newStatus: "packed" }) as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: "order-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.order.status).toBe("packed");
    // PayloadOrderService mirrors shipment-touching stages into the Shipments row.
    expect(stores.orders.get("order-1")!.status).toBe("packed");
    // Notification fan-out fires with the order id + new status.
    expect(emitOrderEvent).toHaveBeenCalledWith("order-1", "packed");
  });

  it("200 includes optional note propagation", async () => {
    seedOrder({ id: "order-1", status: "confirmed" });
    const res = await POST(
      authedReq("order-1", { newStatus: "packed", note: "packed by Ravi" }) as Parameters<typeof POST>[0],
      { params: Promise.resolve({ id: "order-1" }) },
    );
    expect(res.status).toBe(200);
  });

  it("401 when admin auth is missing", async () => {
    seedOrder({ id: "order-1", status: "confirmed" });
    const res = await POST(unauthedReq("order-1", { newStatus: "packed" }) as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: "order-1" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("422 VALIDATION when body is missing newStatus", async () => {
    seedOrder({ id: "order-1", status: "confirmed" });
    const res = await POST(authedReq("order-1", {}) as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: "order-1" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("422 VALIDATION when newStatus is not a known OrderStatus", async () => {
    seedOrder({ id: "order-1", status: "confirmed" });
    const res = await POST(
      authedReq("order-1", { newStatus: "not-a-real-status" }) as Parameters<typeof POST>[0],
      { params: Promise.resolve({ id: "order-1" }) },
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("409 INVALID_STATE_TRANSITION when transition is illegal (delivered -> confirmed)", async () => {
    seedOrder({ id: "order-1", status: "delivered" });
    const res = await POST(
      authedReq("order-1", { newStatus: "confirmed" }) as Parameters<typeof POST>[0],
      { params: Promise.resolve({ id: "order-1" }) },
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATE_TRANSITION");
    // order unchanged
    expect(stores.orders.get("order-1")!.status).toBe("delivered");
  });

  it("404 ORDER_NOT_FOUND when order id is unknown", async () => {
    const res = await POST(
      authedReq("missing-id", { newStatus: "packed" }) as Parameters<typeof POST>[0],
      { params: Promise.resolve({ id: "missing-id" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("ORDER_NOT_FOUND");
  });
});
