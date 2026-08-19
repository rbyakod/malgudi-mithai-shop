// app/api/mobile/v1/addresses/route.test.ts
// Tests for addresses list + create — Task 5.3 (Mishran Mobile Apps v1).
//
// Path depth: 5 `../` to repo root (api/mobile/v1/addresses = 4 dirs under app/).
import { describe, it, expect, beforeEach, vi } from "vitest";

const { payloadMock, requireCustomer, clearDefaultAddress } = vi.hoisted(() => ({
  payloadMock: {
    find: vi.fn(),
    create: vi.fn(),
  },
  requireCustomer: vi.fn(),
  clearDefaultAddress: vi.fn(),
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => payloadMock),
}));

vi.mock("../../../../../payload.config", () => ({ default: {} }));

vi.mock("../../../../../lib/api/authMiddleware", () => ({
  requireCustomer,
}));

// Mock the shared invariant helper so we can assert it fires on isDefault,
// without depending on its internal find+update shape here.
vi.mock("../../../../../lib/addresses/defaultInvariant", () => ({
  clearDefaultAddress,
}));

import { GET, POST } from "./route";

function req(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/mobile/v1/addresses", {
    method,
    headers: { "content-type": "application/json", authorization: "Bearer good" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const validAddress = {
  line1: "12 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

describe("GET /api/mobile/v1/addresses", () => {
  beforeEach(() => {
    payloadMock.find.mockReset();
    payloadMock.create.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
    clearDefaultAddress.mockReset();
    clearDefaultAddress.mockResolvedValue(undefined);
  });

  it("200 lists the caller's addresses only", async () => {
    payloadMock.find.mockResolvedValue({ docs: [{ id: "a1", line1: "X" }] });
    const res = await GET(req("GET") as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    // Scoped to the verified customer, never a query-string id.
    expect(payloadMock.find.mock.calls[0][0].where.customerId.equals).toBe("cust-1");
  });
});

describe("POST /api/mobile/v1/addresses", () => {
  beforeEach(() => {
    payloadMock.find.mockReset();
    payloadMock.create.mockReset();
    requireCustomer.mockReset();
    requireCustomer.mockResolvedValue({ customerId: "cust-1" });
    clearDefaultAddress.mockReset();
    clearDefaultAddress.mockResolvedValue(undefined);
  });

  it("201 creates an address scoped to the JWT customer", async () => {
    payloadMock.create.mockResolvedValue({ id: "a1", ...validAddress });
    const res = await POST(req("POST", validAddress) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);
    const created = payloadMock.create.mock.calls[0][0].data;
    expect(created.customerId).toBe("cust-1");
    expect(clearDefaultAddress).not.toHaveBeenCalled();
  });

  it("clears any prior default when isDefault=true", async () => {
    payloadMock.create.mockResolvedValue({ id: "a2" });
    await POST(req("POST", { ...validAddress, isDefault: true }) as Parameters<typeof POST>[0]);
    expect(clearDefaultAddress).toHaveBeenCalledWith(expect.anything(), "cust-1");
  });

  it("ignores a forged customerId in the body (uses the JWT id)", async () => {
    payloadMock.create.mockResolvedValue({ id: "a3" });
    await POST(req("POST", { ...validAddress, customerId: "attacker" }) as Parameters<typeof POST>[0]);
    // create data still carries the verified customer, not the body value.
    expect(payloadMock.create.mock.calls[0][0].data.customerId).toBe("cust-1");
  });

  it("422 VALIDATION when required fields are missing", async () => {
    const res = await POST(req("POST", { line1: "only line" }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
    expect(payloadMock.create).not.toHaveBeenCalled();
  });
});
