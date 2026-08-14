// tests/integration/AppleRevocationFlow.test.ts
// Apple Sign-in revocation flow — Task 20.5.
//
// Exercises the REAL webhook + refresh route handlers against in-memory
// Payload stores. FakeAppleAuthService.verifyServerEventToken decodes the
// fixture event JWT (crypto is jose's job, covered elsewhere); the stubbed
// jwtService.verify mirrors the container's isRevoked semantics: a revoked
// jti row OR the `all:<customerId>` sentinel row rejects the token.
//
// Plan Step 1 contract:
//   - consent-revoked webhook → customer's appleSub cleared + force-logout
//     sentinel written; next refresh attempt → 401 TOKEN_REVOKED.
//   - malformed event token → 401 (Apple retries).
//   - unknown sub → 200 no-op (Apple must not retry forever).

import { describe, it, expect, beforeEach, vi } from "vitest";

const { stores, verifyCalls } = vi.hoisted(() => ({
  stores: {
    customers: new Map<string, Record<string, unknown>>(),
    revokedTokens: new Map<string, Record<string, unknown>>(),
  },
  verifyCalls: [] as string[],
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where?: Record<string, unknown>;
      }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection] ?? new Map();
        const all = Array.from(col.values());
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
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const id = String(data.jti ?? `row-${col.size + 1}`);
        col.set(id, { id, ...data });
        return { id, ...data };
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
    appleAuthService: {
      // Mirrors the fake: base64-decode the payload segment, surface events.
      verifyServerEventToken: vi.fn(async (token: string) => {
        const parts = token.split(".");
        if (parts.length !== 3) throw new Error("malformed event token");
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const claims = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
        const events = claims.events;
        if (!Array.isArray(events) || events.length === 0) {
          throw new Error("event token missing events");
        }
        return events;
      }),
    },
    jwtService: {
      // Mirrors JwtService.verify + the container's isRevoked semantics.
      verify: vi.fn(async (token: string, kind?: string) => {
        if (token === "refresh-live") {
          if (kind && kind !== "refresh") throw new Error("wrong kind");
          const revoked = Array.from(stores.revokedTokens.keys());
          if (revoked.includes("jti-live") || revoked.includes("all:cust-1")) {
            throw new Error("Token revoked");
          }
          verifyCalls.push(token);
          return { customerId: "cust-1", kind: "refresh", jti: "jti-live" };
        }
        throw new Error("Invalid refresh token");
      }),
      revoke: vi.fn(async () => {}),
      issueAccessToken: vi.fn(async (customerId: string) => `access-${customerId}`),
      issueRefreshToken: vi.fn(async (customerId: string) => `refresh-${customerId}`),
    },
  },
}));

import { POST as webhookPOST } from "../../app/api/webhooks/apple/auth-events/route";
import { POST as refreshPOST } from "../../app/api/mobile/v1/auth/refresh/route";

/** Fixture JWT: header.payload.sig — payload carries Apple's `events`. */
function eventToken(events: unknown[]): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64url({ alg: "RS256" })}.${b64url({
    iss: "appleid.apple.com",
    aud: "com.mishran.app",
    iat: Math.floor(Date.now() / 1000),
    events,
  })}.${"signature"}`;
}

function webhookReq(token: string): Request {
  return new Request("http://localhost/api/webhooks/apple/auth-events", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ payload: token }).toString(),
  });
}

function refreshReq(): Request {
  return new Request("http://localhost/api/mobile/v1/auth/refresh", {
    method: "POST",
    headers: { authorization: "Bearer refresh-live" },
  });
}

describe("apple sign-in revocation flow (integration)", () => {
  beforeEach(() => {
    stores.customers.clear();
    stores.revokedTokens.clear();
    verifyCalls.length = 0;
    stores.customers.set("cust-1", {
      id: "cust-1",
      appleSub: "apple-sub-1",
      email: "ravi@privaterelay.appleid.com",
      authProvider: "apple",
    });
  });

  it("refresh works before revocation", async () => {
    const res = await refreshPOST(refreshReq() as never);
    expect(res.status).toBe(200);
  });

  it("consent-revoked clears appleSub, force-logs-out, next refresh → 401", async () => {
    const res = await webhookPOST(webhookReq(eventToken([
      { type: "consent-revoked", sub: "apple-sub-1" },
    ])) as never);
    expect(res.status).toBe(200);

    // Customer no longer tied to the Apple identity.
    expect(stores.customers.get("cust-1")?.appleSub).toBeNull();

    // Force-logout sentinel written for every session of the customer.
    expect(stores.revokedTokens.has("all:cust-1")).toBe(true);

    // The live refresh token is dead on its next use.
    const after = await refreshPOST(refreshReq() as never);
    expect(after.status).toBe(401);
    const body = (await after.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("TOKEN_REVOKED");
  });

  it("malformed event token → 401", async () => {
    const res = await webhookPOST(webhookReq("garbage") as never);
    expect(res.status).toBe(401);
  });

  it("event token without events array → 401", async () => {
    const b64url = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    const noEvents = `${b64url({ alg: "RS256" })}.${b64url({ iss: "appleid.apple.com" })}.sig`;
    const res = await webhookPOST(webhookReq(noEvents) as never);
    expect(res.status).toBe(401);
  });

  it("unknown sub → 200 no-op (no infinite Apple retries)", async () => {
    const res = await webhookPOST(webhookReq(eventToken([
      { type: "consent-revoked", sub: "apple-sub-nobody" },
    ])) as never);
    expect(res.status).toBe(200);
    expect(stores.revokedTokens.size).toBe(0);
  });

  it("email-disabled clears the stored relay email", async () => {
    const res = await webhookPOST(webhookReq(eventToken([
      { type: "email-disabled", sub: "apple-sub-1" },
    ])) as never);
    expect(res.status).toBe(200);
    expect(stores.customers.get("cust-1")?.email).toBeNull();
  });
});
