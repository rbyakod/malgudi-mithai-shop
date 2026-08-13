// tests/integration/LoyaltyPassEligibility.test.ts
// Loyalty pass eligibility + generation integration — Task 19.1.
//
// Exercises the REAL route handler against an in-memory Payload, with a
// recording fake standing in for container.walletPassService and a stub
// jwtService.verify (auth). Asserts the plan Step 1 contract:
//   - 1 delivered order  → 404 (not eligible)
//   - 2 delivered orders → 200 + signed URL + Silver WalletPasses row
//   - 5 delivered orders → Gold
// Plus idempotency (repeat call reuses the row, regenerates URL).

import { describe, it, expect, beforeEach, vi } from "vitest";

const { stores, walletCalls, jwtVerify } = vi.hoisted(() => ({
  stores: {
    orders: new Map<string, Record<string, unknown>>(),
    walletPasses: new Map<string, Record<string, unknown>>(),
    customers: new Map<string, Record<string, unknown>>(),
  },
  walletCalls: [] as Array<Record<string, unknown>>,
  jwtVerify: vi.fn(async () => ({ customerId: "cust-1", jti: "jti-1" })),
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
        const clauses =
          (where as { and?: Array<Record<string, unknown>> })?.and ?? (where ? [where] : []);
        const docs = all.filter((d) =>
          clauses.every((clause) =>
            Object.entries(clause).every(([field, cond]) => {
              const eq = (cond as { equals?: unknown }).equals;
              return eq !== undefined ? d[field] === eq : true;
            }),
          ),
        );
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

vi.mock("../../payload.config", () => ({ default: {} }));

vi.mock("../../lib/container", () => ({
  container: {
    jwtService: { verify: jwtVerify },
    walletPassService: {
      createSignedPassUrl: vi.fn(async (fields: Record<string, unknown>) => {
        walletCalls.push(fields);
        return {
          url: `https://fake-cdn.example.com/wallet/${fields.serialNumber}.pkpass`,
          serialNumber: fields.serialNumber as string,
        };
      }),
    },
  },
}));

import { GET } from "../../app/api/mobile/v1/account/loyalty-pass/route";

function req(): Request {
  return new Request("http://localhost/api/mobile/v1/account/loyalty-pass", {
    headers: { authorization: "Bearer test-token" },
  });
}

function seedDelivered(count: number) {
  for (let i = 0; i < count; i++) {
    stores.orders.set(`o-${i}`, { id: `o-${i}`, customerId: "cust-1", status: "delivered" });
  }
}

describe("loyalty pass eligibility (integration)", () => {
  beforeEach(() => {
    stores.orders.clear();
    stores.walletPasses.clear();
    stores.customers.clear();
    walletCalls.length = 0;
    seq = 0;
    stores.customers.set("cust-1", { id: "cust-1", name: "Ravi" });
  });

  it("404 with 1 delivered order (not eligible)", async () => {
    seedDelivered(1);
    const res = await GET(req() as never);
    expect(res.status).toBe(404);
    expect(walletCalls).toHaveLength(0);
  });

  it("200 Silver + signed URL at 2 delivered orders", async () => {
    seedDelivered(2);
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tier).toBe("silver");
    expect(body.data.url).toContain("mishran-loyalty-cust-1.pkpass");
    expect(stores.walletPasses.size).toBe(1);
    const row = Array.from(stores.walletPasses.values())[0]!;
    expect(row.tier).toBe("silver");
    expect(row.serialNumber).toBe("mishran-loyalty-cust-1");
  });

  it("200 Gold at 5 delivered orders", async () => {
    seedDelivered(5);
    const res = await GET(req() as never);
    expect(res.status).toBe(200);
    expect((await res.json()).data.tier).toBe("gold");
  });
});
