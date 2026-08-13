// lib/notifications/OrderEventEmitter.test.ts
// OrderEventEmitter tests — Task 5.2.
//
// Payload is mocked wholesale: findByID / find return scripted docs. The
// container is mocked so pushService / smsService are vitest spies we can
// assert against. OrderEventEmitter lives at the seam between Payload and
// the notification adapters — the unit tests cover that wiring, not the
// adapters themselves (which have their own test files).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
//
// vi.hoisted(): vitest hoists vi.mock() calls above every import, so any
// plain `const spy = vi.fn()` referenced inside a mock factory is read
// before it's initialized -> "Cannot access X before initialization".
// Declaring the spies inside vi.hoisted() lifts them to the same hoisted
// phase as the mocks, so the factories see live references.

const mocks = vi.hoisted(() => ({
  payloadFindById: vi.fn(),
  payloadFind: vi.fn(),
  pushSendToTokens: vi.fn(),
  smsSend: vi.fn(),
}));

const { payloadFindById, payloadFind, pushSendToTokens, smsSend } = mocks;

vi.mock("payload", () => ({
  getPayload: vi.fn().mockResolvedValue({
    findByID: (...args: unknown[]) => mocks.payloadFindById(...args),
    find: (...args: unknown[]) => mocks.payloadFind(...args),
  }),
}));

vi.mock("../../payload.config", () => ({ default: {} }));

// Container spies. We swap the whole container so the emitter's
// `container.pushService` resolves to our spy.
vi.mock("../container", () => ({
  container: {
    pushService: { sendToTokens: mocks.pushSendToTokens },
    smsService: { send: mocks.smsSend },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

import { emitOrderEvent } from "./OrderEventEmitter";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeOrder(customerId: string | number) {
  return { id: "order-123", customerId, status: "confirmed" };
}

function makeCustomer(phone?: string) {
  return { id: "cust-1", phone, locale: "en" };
}

function makeDevices(tokens: string[]) {
  return {
    docs: tokens.map((t) => ({ id: `dev-${t}`, pushToken: t, active: true })),
  };
}

function setOrderFound(order: unknown) {
  payloadFindById.mockImplementation((args: { collection: string }) => {
    if (args.collection === "orders") return order;
    return undefined;
  });
}

function setCustomerFound(customer: unknown) {
  payloadFindById.mockImplementation((args: { collection: string }) => {
    if (args.collection === "customers") return customer;
    return undefined;
  });
}

// ---------------------------------------------------------------------------

describe("emitOrderEvent", () => {
  beforeEach(() => {
    pushSendToTokens.mockReset();
    smsSend.mockReset();
    payloadFindById.mockReset();
    payloadFind.mockReset();
    pushSendToTokens.mockResolvedValue({ success: [], failed: [] });
    smsSend.mockResolvedValue({ messageId: "msg-1" });
  });

  it("sends push when active devices exist", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      if (args.collection === "customers") return makeCustomer("+919999999999");
      return undefined;
    });
    payloadFind.mockResolvedValue(makeDevices(["tok-1", "tok-2"]));

    await emitOrderEvent("order-123", "confirmed");

    expect(pushSendToTokens).toHaveBeenCalledOnce();
    const call = pushSendToTokens.mock.calls[0][0];
    expect(call.tokens).toEqual(["tok-1", "tok-2"]);
    expect(call.title).toBe("push.order.confirmed.title");
    expect(call.body).toBe("push.order.confirmed.body");
    expect(call.data.orderId).toBe("order-123");
    expect(call.data.stage).toBe("confirmed");
    expect(call.data.event_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("skips push when customer has no active devices", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      if (args.collection === "customers") return makeCustomer("+919999999999");
      return undefined;
    });
    payloadFind.mockResolvedValue({ docs: [] });

    await emitOrderEvent("order-123", "confirmed");

    expect(pushSendToTokens).not.toHaveBeenCalled();
  });

  it("sends SMS when template.sms=true and customer.phone present", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      if (args.collection === "customers") return makeCustomer("+919999999999");
      return undefined;
    });
    payloadFind.mockResolvedValue(makeDevices(["tok-1"]));

    await emitOrderEvent("order-456", "dispatched");

    expect(smsSend).toHaveBeenCalledOnce();
    const call = smsSend.mock.calls[0][0];
    expect(call.phone).toBe("+919999999999");
    // dispatched template uses the dispatched body key
    expect(call.templateKey).toBe("push.order.dispatched.body");
    expect(call.vars.id).toBe("order-456".slice(-8));
  });

  it("skips SMS when customer.phone is missing", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      if (args.collection === "customers") return makeCustomer(); // no phone
      return undefined;
    });
    payloadFind.mockResolvedValue(makeDevices(["tok-1"]));

    await emitOrderEvent("order-123", "confirmed");

    expect(smsSend).not.toHaveBeenCalled();
  });

  it("skips SMS when stage template has sms=false (packed)", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      if (args.collection === "customers") return makeCustomer("+919999999999");
      return undefined;
    });
    payloadFind.mockResolvedValue(makeDevices(["tok-1"]));

    await emitOrderEvent("order-123", "packed");

    expect(smsSend).not.toHaveBeenCalled();
  });

  it("no-ops on unknown stage", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      return undefined;
    });

    await emitOrderEvent("order-123", "created");

    expect(pushSendToTokens).not.toHaveBeenCalled();
    expect(smsSend).not.toHaveBeenCalled();
  });

  it("no-ops when order is not found", async () => {
    payloadFindById.mockResolvedValue(undefined);

    await emitOrderEvent("missing", "confirmed");

    expect(pushSendToTokens).not.toHaveBeenCalled();
    expect(smsSend).not.toHaveBeenCalled();
  });

  it("does not throw when push fails (fault tolerance)", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      if (args.collection === "customers") return makeCustomer("+919999999999");
      return undefined;
    });
    payloadFind.mockResolvedValue(makeDevices(["tok-1"]));
    pushSendToTokens.mockRejectedValue(new Error("fcm down"));

    // Should not throw — emitter logs + swallows so the route stays alive.
    await expect(emitOrderEvent("order-123", "confirmed")).resolves.toBeUndefined();
  });

  it("does not throw when SMS fails (fault tolerance)", async () => {
    payloadFindById.mockImplementation((args: { collection: string }) => {
      if (args.collection === "orders") return makeOrder("cust-1");
      if (args.collection === "customers") return makeCustomer("+919999999999");
      return undefined;
    });
    payloadFind.mockResolvedValue(makeDevices(["tok-1"]));
    smsSend.mockRejectedValue(new Error("msg92 down"));

    await expect(emitOrderEvent("order-123", "confirmed")).resolves.toBeUndefined();
  });
});
