// tests/unit/api-client.test.ts
// Unit tests for lib/web/apiClient — the storefront's typed client for the
// mobile API surface. Covers the envelope unwrap, typed error mapping,
// X-Client-Source/Bearer/Idempotency-Key headers, and — the load-bearing
// part — SINGLE-FLIGHT refresh: the server rotates refresh tokens and
// revokes the old jti, so two parallel 401s must share one refresh call
// or the second one would sign the customer out (plan risk R2).

import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {
  apiFetch,
  ApiClientError,
  bindAuth,
  API_BASE,
} from "@/lib/web/apiClient";

// Minimal Response builder — Node's undici Response provides ok/json().
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type": "application/json"},
  });
}

type Store = {
  access: string | null;
  refresh: string | null;
  rotated: Array<[string, string]>;
  expiredCount: number;
};

let store: Store;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = {
    access: "old-access",
    refresh: "old-refresh",
    rotated: [],
    expiredCount: 0,
  };
  bindAuth({
    getAccessToken: () => store.access,
    getRefreshToken: () => store.refresh,
    onTokensRotated: (a, r) => {
      store.rotated.push([a, r]);
      store.access = a;
      store.refresh = r;
    },
    onSessionExpired: () => {
      store.expiredCount += 1;
    },
  });
});

afterEach(() => {
  bindAuth(null);
  vi.unstubAllGlobals();
});

function lastInit(): RequestInit | undefined {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[1];
}

describe("apiClient envelope + errors", () => {
  it("unwraps the {data} envelope", async () => {
    fetchMock = vi.fn(async () => json({data: {items: [1, 2, 3]}}));
    vi.stubGlobal("fetch", fetchMock);
    const result = await apiFetch<{items: number[]}>("/orders");
    expect(result).toEqual({items: [1, 2, 3]});
  });

  it("sends X-Client-Source: web, Bearer token, and JSON content type", async () => {
    fetchMock = vi.fn(async () => json({data: {ok: true}}));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/addresses", {method: "POST", body: {line1: "12 MG Road"}});
    const init = lastInit();
    const headers = init?.headers as Record<string, string>;
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/addresses`);
    expect(headers["X-Client-Source"]).toBe("web");
    expect(headers.Authorization).toBe("Bearer old-access");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({line1: "12 MG Road"}));
  });

  it("omits Authorization when no session is bound", async () => {
    store.access = null;
    fetchMock = vi.fn(async () => json({data: {ok: true}}));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/auth/otp/send", {method: "POST", body: {phone: "+910000000000"}});
    const headers = lastInit()?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["X-Client-Source"]).toBe("web");
  });

  it("sets the Idempotency-Key header when requested", async () => {
    fetchMock = vi.fn(async () => json({data: {orderId: "o1"}}));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/payments/razorpay/create-order", {
      method: "POST",
      body: {snapshotId: "s1"},
      idempotencyKey: "key-123",
    });
    const headers = lastInit()?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("key-123");
  });

  it("maps error bodies to a typed ApiClientError", async () => {
    fetchMock = vi.fn(
      async () =>
        json({error: {code: "VALIDATION", message: "Invalid address body", fieldErrors: {pincode: "required"}}}, 422),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await apiFetch("/addresses", {method: "POST", body: {}});
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiClientError);
      const e = err as ApiClientError;
      expect(e.status).toBe(422);
      expect(e.code).toBe("VALIDATION");
      expect(e.fieldErrors).toEqual({pincode: "required"});
      expect(e.message).toBe("Invalid address body");
    }
  });
});

describe("apiClient single-flight refresh", () => {
  function stubSequential(responses: Array<() => Response>) {
    let i = 0;
    fetchMock = vi.fn(async () => {
      const make = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return make();
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  it("two parallel 401 TOKEN_EXPIRED calls trigger exactly one refresh and both retry once", async () => {
    const state = {refreshCalls: 0, ordersCalls: 0};
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `${API_BASE}/auth/refresh`) {
        state.refreshCalls += 1;
        return json({data: {accessToken: "new-access", refreshToken: "new-refresh"}});
      }
      if (url.startsWith(`${API_BASE}/orders`)) {
        state.ordersCalls += 1;
        const auth = (init?.headers as Record<string, string>)?.Authorization;
        if (auth === "Bearer new-access") {
          return json({data: {items: ["order-a", "order-b"]}});
        }
        return json({error: {code: "TOKEN_EXPIRED", message: "Invalid or expired token"}}, 401);
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    // Fire both before awaiting either — the classic rotation self-destruct.
    const [a, b] = await Promise.all([
      apiFetch<{items: string[]}>("/orders?page=1"),
      apiFetch<{items: string[]}>("/orders?page=2"),
    ]);

    expect(state.refreshCalls).toBe(1);
    expect(a).toEqual({items: ["order-a", "order-b"]});
    expect(b).toEqual({items: ["order-a", "order-b"]});
    // Two initial 401s + one successful retry each — and nothing else.
    expect(state.ordersCalls).toBe(4);
    expect(store.rotated).toHaveLength(2); // once per caller, same pair
    expect(store.rotated[0]).toEqual(["new-access", "new-refresh"]);
    expect(store.expiredCount).toBe(0);
  });

  it("refreshes and retries a single expired request", async () => {
    stubSequential([
      () => json({error: {code: "TOKEN_EXPIRED", message: "expired"}}, 401),
      () => json({data: {accessToken: "new-a", refreshToken: "new-r"}}),
      () => json({data: {items: []}}),
    ]);
    const result = await apiFetch("/orders");
    expect(result).toEqual({items: []});
    expect(store.access).toBe("new-a");
    expect(store.refresh).toBe("new-r");
  });

  it("does not refresh for a non-TOKEN_EXPIRED 401", async () => {
    fetchMock = vi.fn(async () => json({error: {code: "TOKEN_REVOKED", message: "revoked"}}, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/orders")).rejects.toMatchObject({code: "TOKEN_REVOKED"});
    // Only the original request — no refresh, no retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.expiredCount).toBe(0);
  });

  it("refresh failure signs the session out and throws", async () => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `${API_BASE}/auth/refresh`) {
        return json({error: {code: "TOKEN_REVOKED", message: "Invalid refresh token"}}, 401);
      }
      return json({error: {code: "TOKEN_EXPIRED", message: "expired"}}, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/orders")).rejects.toBeInstanceOf(ApiClientError);
    expect(store.expiredCount).toBe(1);
    expect(store.rotated).toHaveLength(0);
  });

  it("a retry that still 401s signs the session out", async () => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `${API_BASE}/auth/refresh`) {
        return json({data: {accessToken: "new-a", refreshToken: "new-r"}});
      }
      return json({error: {code: "TOKEN_EXPIRED", message: "still bad"}}, 401);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/orders")).rejects.toMatchObject({code: "TOKEN_EXPIRED"});
    // initial + refresh + retry — exactly one retry, no refresh loop.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(store.expiredCount).toBe(1);
  });

  it("skips refresh entirely without a bound session", async () => {
    store.access = null;
    store.refresh = null;
    fetchMock = vi.fn(async () => json({error: {code: "TOKEN_EXPIRED", message: "missing"}}, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/orders")).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh call attempted
    expect(store.expiredCount).toBe(1);
  });
});
