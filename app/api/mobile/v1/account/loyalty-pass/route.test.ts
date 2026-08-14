// app/api/mobile/v1/account/loyalty-pass/route.test.ts
// Loyalty pass route tests — Task 19.1.
// Path depth: app/api/mobile/v1/account/loyalty-pass/ = 6 dirs.

import { describe, it, expect, beforeEach, vi } from "vitest";

const { stores, walletCalls, walletResult } = vi.hoisted(() => ({
  stores: {
    // deliveredCount is simulated by the number of 'delivered' order rows.
    orders: new Map<string, Record<string, unknown>>(),
    walletPasses: new Map<string, Record<string, unknown>>(),
    customers: new Map<string, Record<string, unknown>>(),
  },
  walletCalls: [] as Array<Record<string, unknown>>,
  walletResult: { current: "https://fake-cdn.example.com/wallet/x.pkpass" },
}));

let seq = 0;
const nextId = () => `wp-${++seq}`;

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: string }) =>
        (stores as Record<string, Map<string, Record<string, unknown>>>)[collection].get(
          String(id),
        ) ?? null,
    ),
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where?: Record<string, unknown>;
      }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const all = col ? Array.from(col.values()) : [];
        // Filter supporting {and:[...]} + top-level {field:{equals}}.
        const filter = (d: Record<string, unknown>) => {
          if (!where) return true;
          const and = (where as { and?: Array<Record<string, unknown>> }).and;
          const clauses = and ?? [where];
          return clauses.every((clause) =>
            Object.entries(clause).every(([field, cond]) => {
              const eq = (cond as { equals?: unknown }).equals;
              return eq !== undefined ? d[field] === eq : true;
            }),
          );
        };
        const docs = all.filter(filter);
        return { docs, totalDocs: docs.length };
      },
    ),
    create: vi.fn(
      async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        const id = nextId();
        const doc = { id, ...data };
        (stores as Record<string, Map<string, Record<string, unknown>>>)[collection].set(id, doc);
        return doc;
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
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const merged = { ...col.get(id), ...data };
        col.set(id, merged);
        return merged;
      },
    ),
  })),
}));

vi.mock("../../../../../../payload.config", () => ({ default: {} }));

vi.mock("../../../../../../lib/container", () => ({
  container: {
    jwtService: {
      verify: vi.fn(async () => ({ customerId: "cust-1", jti: "jti-1" })),
    },
    walletPassService: {
      createSignedPassUrl: vi.fn(async (fields: Record<string, unknown>) => {
        walletCalls.push(fields);
        return {
          url: walletResult.current,
          serialNumber: fields.serialNumber as string,
        };
      }),
    },
  },
}));

import { GET } from "./route";

function req(authed = true): Request {
  return new Request("http://localhost/api/mobile/v1/account/loyalty-pass", {
    headers: authed ? { authorization: "Bearer test-token" } : {},
  });
}

function seedDeliveredOrders(count: number) {
  for (let i = 0; i < count; i++) {
    stores.orders.set(`ord-${i}`, {
      id: `ord-${i}`,
      customerId: "cust-1",
      status: "delivered",
    });
  }
}

describe("GET /account/loyalty-pass", () => {
  beforeEach(() => {
    stores.orders.clear();
    stores.walletPasses.clear();
    stores.customers.clear();
    walletCalls.length = 0;
    seq = 0;
    stores.customers.set("cust-1", { id: "cust-1", name: "Ravi" });
  });

  it("401 when unauthenticated", async () => {
    const res = await GET(req(false) as never);
    expect(res.status).toBe(401);
  });

  it("404 when not eligible (1 delivered order)", async () => {
    seedDeliveredOrders(1);
    const res = await GET(req() as never);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    expect(walletCalls).toHaveLength(0);
  });

  it("200 Silver + creates WalletPasses row at 2 delivered", async () => {
    seedDeliveredOrders(2);
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tier).toBe("silver");
    expect(body.data.serialNumber).toBe("mishran-loyalty-cust-1");
    expect(body.data.url).toBeTruthy();
    expect(walletCalls).toHaveLength(1);
    expect(walletCalls[0]!.tier).toBe("silver");
    expect(walletCalls[0]!.holderName).toBe("Ravi");
    expect(walletCalls[0]!.balanceLabel).toBe("2");
    // row persisted
    expect(stores.walletPasses.size).toBe(1);
  });

  it("200 Gold at 5 delivered", async () => {
    seedDeliveredOrders(5);
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    expect((await res.json()).data.tier).toBe("gold");
  });

  it("idempotent: second call reuses the row (update, not create)", async () => {
    seedDeliveredOrders(2);
    await GET(req() as never);
    const firstCount = stores.walletPasses.size;
    await GET(req() as never);
    expect(stores.walletPasses.size).toBe(firstCount); // no new row
    expect(walletCalls).toHaveLength(2); // URL regenerated both times
  });

  it("upgrades tier silver -> gold when delivered count grows", async () => {
    seedDeliveredOrders(2);
    await GET(req() as never);
    // Customer reaches Gold.
    seedDeliveredOrders(5); // total 5
    const res = await GET(req() as never);
    const body = await res.json();
    expect(body.data.tier).toBe("gold");
    const row = Array.from(stores.walletPasses.values())[0]!;
    expect(row.tier).toBe("gold");
    // still a single row
    expect(stores.walletPasses.size).toBe(1);
  });
});
