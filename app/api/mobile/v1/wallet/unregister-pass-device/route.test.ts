// app/api/mobile/v1/wallet/unregister-pass-device/route.test.ts
// Tests for Wallet pass-device deregistration — Task 19.2 (Mishran Mobile Apps v1).
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

import { DELETE } from "./route";

function req(body: unknown, authed = true): Request {
  return new Request("http://localhost/api/mobile/v1/wallet/unregister-pass-device", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      ...(authed ? { authorization: "Bearer good-token" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = { serialNumber: "mishran-loyalty-cust-1", pushToken: "pass-token-1" };

describe("DELETE /api/mobile/v1/wallet/unregister-pass-device", () => {
  beforeEach(() => {
    payloadMock.find.mockReset();
    payloadMock.update.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
  });

  it("200 removes the token when present", async () => {
    payloadMock.find.mockResolvedValue({
      docs: [
        {
          id: "pass-1",
          devices: [{ pushToken: "pass-token-1" }, { pushToken: "keep-token" }],
        },
      ],
    });
    payloadMock.update.mockResolvedValue({ id: "pass-1" });

    const res = await DELETE(req(validBody) as any);

    expect(res.status).toBe(200);
    expect(payloadMock.update).toHaveBeenCalledOnce();
    expect(payloadMock.update.mock.calls[0][0].data.devices).toEqual([
      { pushToken: "keep-token" },
    ]);
  });

  it("200 is idempotent when the token is already absent (no write)", async () => {
    payloadMock.find.mockResolvedValue({
      docs: [{ id: "pass-1", devices: [{ pushToken: "other-token" }] }],
    });

    const res = await DELETE(req(validBody) as any);

    expect(res.status).toBe(200);
    expect(payloadMock.update).not.toHaveBeenCalled();
  });

  it("200 is idempotent when the pass is not found", async () => {
    payloadMock.find.mockResolvedValue({ docs: [] });

    const res = await DELETE(req(validBody) as any);

    expect(res.status).toBe(200);
    expect(payloadMock.update).not.toHaveBeenCalled();
  });

  it("422 VALIDATION when the body is missing required fields", async () => {
    const res = await DELETE(req({ serialNumber: "s" }) as any);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("401 when the caller is unauthenticated", async () => {
    const { ApiError, ErrorCode } = await import("../../../../../../lib/api/errors");
    requireCustomer.mockRejectedValue(new ApiError(ErrorCode.TOKEN_EXPIRED, "no token"));
    const res = await DELETE(req(validBody, false) as any);
    expect(res.status).toBe(401);
  });
});
