// app/api/cron/reconcile-payments/route.test.ts
// Tests for the cron route auth + happy-path invocation — Task 4.7.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock is hoisted above imports — use vi.hoisted so the mock factory
// can reference the spy without a TDZ error.
const hoisted = vi.hoisted(() => ({ reconcileMock: vi.fn() }));

vi.mock("../../../../lib/reconciliation/reconcilePayments", () => ({
  reconcilePayments: hoisted.reconcileMock,
}));

import { GET } from "./route";

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("https://test.local/api/cron/reconcile-payments", {
    headers,
  });
}

describe("GET /api/cron/reconcile-payments", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    hoisted.reconcileMock.mockReset();
    process.env.CRON_SECRET = "test-secret-value";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(hoisted.reconcileMock).not.toHaveBeenCalled();
  });

  it("returns 401 when Bearer token is wrong", async () => {
    const res = await GET(
      makeReq({ authorization: "Bearer wrong-secret" }),
    );
    expect(res.status).toBe(401);
    expect(hoisted.reconcileMock).not.toHaveBeenCalled();
  });

  it("returns 401 when scheme is wrong (not Bearer)", async () => {
    const res = await GET(
      makeReq({ authorization: `Basic ${process.env.CRON_SECRET}` }),
    );
    expect(res.status).toBe(401);
    expect(hoisted.reconcileMock).not.toHaveBeenCalled();
  });

  it("returns 401 on missing space after Bearer", async () => {
    // "Bearer<secret>" without a space — must not match "Bearer <secret>".
    const res = await GET(
      makeReq({ authorization: `Bearer${process.env.CRON_SECRET}` }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET env is missing (operator misconfig)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(
      makeReq({ authorization: "Bearer anything" }),
    );
    expect(res.status).toBe(500);
    expect(hoisted.reconcileMock).not.toHaveBeenCalled();
  });

  it("accepts correct Bearer token, runs reconcile, returns 200 with summary", async () => {
    hoisted.reconcileMock.mockResolvedValueOnce({
      inspected: 3,
      captured: 1,
      failed: 1,
      pending: 1,
      errors: 0,
    });
    const res = await GET(
      makeReq({ authorization: "Bearer test-secret-value" }),
    );
    expect(res.status).toBe(200);
    expect(hoisted.reconcileMock).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toEqual({
      status: "ok",
      inspected: 3,
      captured: 1,
      failed: 1,
      pending: 1,
      errors: 0,
    });
  });

  it("returns 200 with empty summary when reconcile finds nothing", async () => {
    hoisted.reconcileMock.mockResolvedValueOnce({
      inspected: 0,
      captured: 0,
      failed: 0,
      pending: 0,
      errors: 0,
    });
    const res = await GET(
      makeReq({ authorization: "Bearer test-secret-value" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inspected).toBe(0);
  });

  it("uses timing-safe compare (length-mismatch does not throw, returns 401)", async () => {
    // Send a token much longer than the secret — should NOT throw from
    // timingSafeEqual (length short-circuit) and return 401.
    const longToken = "Bearer " + "x".repeat(500);
    const res = await GET(makeReq({ authorization: longToken }));
    expect(res.status).toBe(401);
    expect(hoisted.reconcileMock).not.toHaveBeenCalled();
  });
});
