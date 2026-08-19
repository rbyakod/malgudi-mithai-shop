// app/api/mobile/v1/notifications/register-device/route.test.ts
// Tests for device-registration upsert — Task 5.3 (Mishran Mobile Apps v1).
//
// Path depth matches the route: 6 `../` to repo root.
import { describe, it, expect, beforeEach, vi } from "vitest";

const { payloadMock, requireCustomer } = vi.hoisted(() => ({
  payloadMock: {
    find: vi.fn(),
    create: vi.fn(),
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
  return new Request("http://localhost/api/mobile/v1/notifications/register-device", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authed ? { authorization: "Bearer good-token" } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  platform: "android",
  pushToken: "token-abc",
  appVersion: "1.0.0",
};

describe("POST /api/mobile/v1/notifications/register-device", () => {
  beforeEach(() => {
    payloadMock.find.mockReset();
    payloadMock.create.mockReset();
    payloadMock.update.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
  });

  it("201-ish upsert: creates a device row when the token is new", async () => {
    payloadMock.find.mockResolvedValue({ docs: [] });
    payloadMock.create.mockResolvedValue({ id: "dev-1" });

    const res = await POST(req(validBody) as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(payloadMock.create).toHaveBeenCalledOnce();
    const created = payloadMock.create.mock.calls[0][0].data;
    expect(created.customerId).toBe("cust-1");
    expect(created.active).toBe(true);
    expect(created.pushToken).toBe("token-abc");
    expect(payloadMock.update).not.toHaveBeenCalled();
  });

  it("200 upsert: rebinds + reactivates an existing token", async () => {
    payloadMock.find.mockResolvedValue({ docs: [{ id: "dev-9", active: false }] });
    payloadMock.update.mockResolvedValue({ id: "dev-9" });

    const res = await POST(req({ ...validBody, platform: "ios" }) as Parameters<typeof POST>[0]);

    expect(res.status).toBe(200);
    expect(payloadMock.update).toHaveBeenCalledOnce();
    expect(payloadMock.update.mock.calls[0][0].id).toBe("dev-9");
    expect(payloadMock.update.mock.calls[0][0].data.active).toBe(true);
    expect(payloadMock.update.mock.calls[0][0].data.customerId).toBe("cust-1");
    expect(payloadMock.create).not.toHaveBeenCalled();
  });

  it("422 VALIDATION when platform is missing or invalid", async () => {
    const res = await POST(req({ pushToken: "t" }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
    expect(payloadMock.create).not.toHaveBeenCalled();
  });

  it("422 VALIDATION when pushToken is empty", async () => {
    const res = await POST(req({ platform: "android", pushToken: "" }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(422);
  });

  it("401 when the caller is unauthenticated", async () => {
    const { ApiError, ErrorCode } = await import("../../../../../../lib/api/errors");
    requireCustomer.mockRejectedValue(new ApiError(ErrorCode.TOKEN_EXPIRED, "no token"));
    const res = await POST(req(validBody, false) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("TOKEN_EXPIRED");
  });

  // Task 18.3: iOS Live Activity push tokens ride the same upsert so
  // OrderEventEmitter can fire .liveactivity content-state updates.
  it("200 upsert: persists a liveActivityToken when provided", async () => {
    payloadMock.find.mockResolvedValue({ docs: [{ id: "dev-7", active: true }] });
    payloadMock.update.mockResolvedValue({ id: "dev-7" });

    const res = await POST(
      req({ platform: "ios", pushToken: "apns-1", liveActivityToken: "la-1" }) as Parameters<typeof POST>[0],
    );

    expect(res.status).toBe(200);
    expect(payloadMock.update.mock.calls[0][0].data.liveActivityToken).toBe("la-1");
  });

  it("422 VALIDATION when liveActivityToken is present but empty", async () => {
    const res = await POST(
      req({ platform: "ios", pushToken: "t", liveActivityToken: "" }) as Parameters<typeof POST>[0],
    );
    expect(res.status).toBe(422);
  });
});
