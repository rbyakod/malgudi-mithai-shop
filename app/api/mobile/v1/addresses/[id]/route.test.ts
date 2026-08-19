// app/api/mobile/v1/addresses/[id]/route.test.ts
// Tests for address GET/PATCH/DELETE with ownership gating — Task 5.3.
//
// Path depth: 6 `../` to repo root.
import { describe, it, expect, beforeEach, vi } from "vitest";

const { payloadMock, requireCustomer, clearDefaultAddress } = vi.hoisted(() => ({
  payloadMock: {
    findByID: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  requireCustomer: vi.fn(),
  clearDefaultAddress: vi.fn(),
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => payloadMock),
}));

vi.mock("../../../../../../payload.config", () => ({ default: {} }));

vi.mock("../../../../../../lib/api/authMiddleware", () => ({
  requireCustomer,
}));

vi.mock("../../../../../../lib/addresses/defaultInvariant", () => ({
  clearDefaultAddress,
}));

import { GET, PATCH, DELETE } from "./route";

function req(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/mobile/v1/addresses/a1", {
    method,
    headers: { "content-type": "application/json", authorization: "Bearer good" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (id = "a1") => ({ params: Promise.resolve({ id }) });

describe("GET /api/mobile/v1/addresses/:id", () => {
  beforeEach(() => {
    payloadMock.findByID.mockReset();
    payloadMock.update.mockReset();
    payloadMock.delete.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
    clearDefaultAddress.mockReset();
    clearDefaultAddress.mockResolvedValue(undefined);
  });

  it("200 returns the address when owned by the caller", async () => {
    payloadMock.findByID.mockResolvedValue({ id: "a1", customerId: "cust-1", line1: "X" });
    const res = await GET(req("GET") as Parameters<typeof GET>[0], ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.address.id).toBe("a1");
  });

  it("404 when the address belongs to another customer (IDOR)", async () => {
    payloadMock.findByID.mockResolvedValue({ id: "a1", customerId: "cust-other" });
    const res = await GET(req("GET") as Parameters<typeof GET>[0], ctx());
    expect(res.status).toBe(404);
    expect(payloadMock.delete).not.toHaveBeenCalled();
  });

  it("404 when the address is missing (findByID throws)", async () => {
    payloadMock.findByID.mockRejectedValue(Object.assign(new Error("nf"), { statusCode: 404 }));
    const res = await GET(req("GET") as Parameters<typeof GET>[0], ctx("missing"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/mobile/v1/addresses/:id", () => {
  beforeEach(() => {
    payloadMock.findByID.mockReset();
    payloadMock.update.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
    clearDefaultAddress.mockReset();
    clearDefaultAddress.mockResolvedValue(undefined);
  });

  it("200 updates an owned address", async () => {
    payloadMock.findByID.mockResolvedValue({ id: "a1", customerId: "cust-1" });
    payloadMock.update.mockResolvedValue({ id: "a1", line1: "new" });
    const res = await PATCH(req("PATCH", { line1: "new" }) as Parameters<typeof PATCH>[0], ctx());
    expect(res.status).toBe(200);
    expect(payloadMock.update.mock.calls[0][0].data).toEqual({ line1: "new" });
  });

  it("clears prior default when promoting to isDefault, preserving self", async () => {
    payloadMock.findByID.mockResolvedValue({ id: "a1", customerId: "cust-1" });
    payloadMock.update.mockResolvedValue({ id: "a1" });
    await PATCH(req("PATCH", { isDefault: true }) as Parameters<typeof PATCH>[0], ctx());
    expect(clearDefaultAddress).toHaveBeenCalledWith(expect.anything(), "cust-1", "a1");
  });

  it("404 when PATCH targets another customer's address", async () => {
    payloadMock.findByID.mockResolvedValue({ id: "a1", customerId: "cust-other" });
    const res = await PATCH(req("PATCH", { line1: "new" }) as Parameters<typeof PATCH>[0], ctx());
    expect(res.status).toBe(404);
    expect(payloadMock.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/mobile/v1/addresses/:id", () => {
  beforeEach(() => {
    payloadMock.findByID.mockReset();
    payloadMock.delete.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
  });

  it("200 deletes an owned address", async () => {
    payloadMock.findByID.mockResolvedValue({ id: "a1", customerId: "cust-1" });
    const res = await DELETE(req("DELETE") as Parameters<typeof DELETE>[0], ctx());
    expect(res.status).toBe(200);
    expect(payloadMock.delete).toHaveBeenCalledOnce();
  });

  it("404 when deleting another customer's address (no delete call)", async () => {
    payloadMock.findByID.mockResolvedValue({ id: "a1", customerId: "cust-other" });
    const res = await DELETE(req("DELETE") as Parameters<typeof DELETE>[0], ctx());
    expect(res.status).toBe(404);
    expect(payloadMock.delete).not.toHaveBeenCalled();
  });
});
