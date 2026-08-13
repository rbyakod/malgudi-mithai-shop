// app/api/mobile/v1/auth/apple/route.test.ts
// Sign-in-with-Apple route tests — Task 15.3.
// Path depth: app/api/mobile/v1/auth/apple/ = 6 dirs.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeAppleAuthService, fixtureAppleToken } from "../../../../../../lib/auth/impl/FakeAppleAuthService";

const { stores, jwtIssueAccess, jwtIssueRefresh } = vi.hoisted(() => ({
  stores: {
    customers: new Map<string, Record<string, unknown>>(),
    idempotencyKeys: new Map<string, Record<string, unknown>>(),
  },
  jwtIssueAccess: vi.fn(async (id: string) => `access-${id}`),
  jwtIssueRefresh: vi.fn(async (id: string) => `refresh-${id}`),
}));

let seq = 0;
const nextId = () => `cust-${++seq}`;

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(async () => null),
    find: vi.fn(
      async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const all = col ? Array.from(col.values()) : [];
        const docs = all.filter((d) => {
          if (!where) return true;
          return Object.entries(where).every(([field, cond]) => {
            const eq = (cond as { equals?: unknown }).equals;
            return eq !== undefined ? d[field] === eq : true;
          });
        });
        return { docs, totalDocs: docs.length };
      },
    ),
    create: vi.fn(
      async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        const id = collection === "idempotencyKeys" ? (data.key as string) : nextId();
        const doc = { id, createdAt: new Date().toISOString(), ...data };
        (stores as Record<string, Map<string, Record<string, unknown>>>)[collection].set(id, doc);
        return doc;
      },
    ),
    update: vi.fn(
      async ({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
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
    appleAuthService: new FakeAppleAuthService(),
    jwtService: { issueAccessToken: jwtIssueAccess, issueRefreshToken: jwtIssueRefresh },
  },
}));

import { POST } from "./route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/mobile/v1/auth/apple", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /auth/apple", () => {
  beforeEach(() => {
    stores.customers.clear();
    stores.idempotencyKeys.clear();
    seq = 0;
    jwtIssueAccess.mockClear();
    jwtIssueRefresh.mockClear();
  });

  it("200: valid identity token upserts customer + returns JWT pair", async () => {
    const token = fixtureAppleToken({ sub: "apple-001", email: "ravi@privaterelay.appleid.com", email_verified: true });
    const res = await POST(req({ identityToken: token, name: "Ravi" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBe(`access-${body.data.customer.id}`);
    expect(body.data.refreshToken).toMatch(/^refresh-/);
    expect(body.data.customer.email).toBe("ravi@privaterelay.appleid.com");
    expect(body.data.customer.phone).toBeNull();
    // customer persisted with appleSub + authProvider
    const stored = Array.from(stores.customers.values())[0]!;
    expect(stored.appleSub).toBe("apple-001");
    expect(stored.authProvider).toBe("apple");
    expect(stored.name).toBe("Ravi");
    expect(jwtIssueAccess).toHaveBeenCalledTimes(1);
  });

  it("401: malformed identity token", async () => {
    const res = await POST(req({ identityToken: "not-a-jwt" }) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("TOKEN_EXPIRED");
    expect(stores.customers.size).toBe(0);
  });

  it("409: replay — same identity token used twice", async () => {
    const token = fixtureAppleToken({ sub: "apple-002", email: "b@c.com", email_verified: "true" });
    const r1 = await POST(req({ identityToken: token }) as never);
    expect(r1.status).toBe(200);
    const r2 = await POST(req({ identityToken: token }) as never);
    expect(r2.status).toBe(409);
    expect((await r2.json()).error.code).toBe("CONFLICT");
    // still exactly one customer
    expect(stores.customers.size).toBe(1);
  });

  it("upserts: returning customer with same sub does not duplicate", async () => {
    const sub = "apple-003";
    const t1 = fixtureAppleToken({ sub, email: "first@c.com", email_verified: true });
    await POST(req({ identityToken: t1 }) as never);
    // A *different* token (different hash, no replay) for the same sub, no email.
    const t2 = fixtureAppleToken({ sub });
    const r2 = await POST(req({ identityToken: t2 }) as never);
    expect(r2.status).toBe(200);
    expect(stores.customers.size).toBe(1);
    // email back-filled only when missing; here it was already set.
    const stored = Array.from(stores.customers.values())[0]!;
    expect(stored.email).toBe("first@c.com");
  });

  it("422: missing identityToken", async () => {
    const res = await POST(req({ name: "x" }) as never);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });
});
