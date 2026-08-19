// app/api/mobile/v1/wallet/register-pass-device/route.test.ts
// Tests for Wallet pass-device registration — Task 19.2 (Mishran Mobile Apps v1).
//
// Path depth matches the route: 6 `../` to repo root.
import { describe, it, expect, beforeEach, vi } from "vitest";

const { payloadMock, requireCustomer } = vi.hoisted(() => ({
  payloadMock: {
    find: vi.fn(),
    update: vi.fn(),
  },
  requireCustomer: vi.fn(),
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => payloadMock),
}));

vi.mock("../../../../../../payload.config", () => ({ default: {} }));

vi.mock("../../../../../../lib/api/authMiddleware", () => ({
  requireCustomer,
}));

import { POST } from "./route";

function req(body: unknown, authed = true): Request {
  return new Request("http://localhost/api/mobile/v1/wallet/register-pass-device", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authed ? { authorization: "Bearer good-token" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = { serialNumber: "mishran-loyalty-cust-1", pushToken: "pass-token-1" };

describe("POST /api/mobile/v1/wallet/register-pass-device", () => {
  beforeEach(() => {
    payloadMock.find.mockReset();
    payloadMock.update.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
  });

  it("200 appends the token when the pass exists and the token is new", async () => {
    payloadMock.find.mockResolvedValue({
      docs: [{ id: "pass-1", devices: [{ pushToken: "existing-token" }] }],
    });
    payloadMock.update.mockResolvedValue({ id: "pass-1" });

    const res = await POST(req(validBody) as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(payloadMock.update).toHaveBeenCalledOnce();
    const updated = payloadMock.update.mock.calls[0][0];
    expect(updated.id).toBe("pass-1");
    expect(updated.data.devices).toEqual([
      { pushToken: "existing-token" },
      { pushToken: "pass-token-1" },
    ]);
  });

  it("200 is idempotent when the token is already registered (no write)", async () => {
    payloadMock.find.mockResolvedValue({
      docs: [{ id: "pass-1", devices: [{ pushToken: "pass-token-1" }] }],
    });

    const res = await POST(req(validBody) as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(payloadMock.update).not.toHaveBeenCalled();
  });

  it("appends to an empty devices array (pass exists, no devices yet)", async () => {
    payloadMock.find.mockResolvedValue({ docs: [{ id: "pass-1", devices: [] }] });
    payloadMock.update.mockResolvedValue({ id: "pass-1" });

    const res = await POST(req(validBody) as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(payloadMock.update.mock.calls[0][0].data.devices).toEqual([
      { pushToken: "pass-token-1" },
    ]);
  });

  it("404 NOT_FOUND when no active owned pass matches the serial", async () => {
    payloadMock.find.mockResolvedValue({ docs: [] });

    const res = await POST(req(validBody) as Parameters<typeof POST>[0]);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(payloadMock.update).not.toHaveBeenCalled();
  });

  it("422 VALIDATION when the body is missing required fields", async () => {
    const res = await POST(req({ pushToken: "t" }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
    expect(payloadMock.update).not.toHaveBeenCalled();
  });

  it("401 when the caller is unauthenticated", async () => {
    const { ApiError, ErrorCode } = await import("../../../../../../lib/api/errors");
    requireCustomer.mockRejectedValue(new ApiError(ErrorCode.TOKEN_EXPIRED, "no token"));
    const res = await POST(req(validBody, false) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });
});
