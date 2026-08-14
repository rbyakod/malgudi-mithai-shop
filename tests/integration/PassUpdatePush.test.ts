// tests/integration/PassUpdatePush.test.ts
// Integration test — Apple Wallet `.pass` update push (Task 19.2).
//
// Exercises OrderEventEmitter.emitOrderEvent at the delivered stage for a
// loyalty customer whose pass is already in Apple Wallet with registered
// device tokens. Asserts the emitter fires one APNs `.pass` push per
// registered device, carrying the refreshed balance + tier, and that a
// pass with no devices (or no pass yet) sends no push.
//
// The container is mocked wholesale (same seam as OrderEventEmitter.test.ts):
// apnsService is an inline fake whose sendPassUpdate records every call. The
// payload is an in-memory mock routed by collection. No real Mongo / APNs.

import { describe, it, expect, beforeEach, vi } from "vitest";

// vi.hoisted: the container mock factory + test body must share the same fake
// instances. Per the TDZ lesson, fakes are defined INLINE in the hoisted block
// (no `new` of an imported class here — that trips before top-level imports
// initialize).
const mocks = vi.hoisted(() => {
  const passUpdateCalls: Array<{
    deviceToken: string;
    serialNumber: string;
    fields?: { tier?: string; balanceLabel?: string; holderName?: string };
  }> = [];
  return {
    passUpdateCalls,
    apnsFake: {
      sendPassUpdate: vi.fn(
        async (
          deviceToken: string,
          serialNumber: string,
          fields?: { tier?: string; balanceLabel?: string; holderName?: string },
        ) => {
          passUpdateCalls.push({ deviceToken, serialNumber, fields });
        },
      ),
      sendLiveActivityUpdate: vi.fn(async () => {}),
      sendToTokens: vi.fn(async () => ({ success: [], failed: [] })),
    },
    walletStub: {
      createSignedPassUrl: vi.fn(async () => ({
        url: "https://fake/cust-1.pkpass",
        serialNumber: "mishran-loyalty-cust-1",
      })),
    },
    payloadFindById: vi.fn(),
    payloadFind: vi.fn(),
    payloadCreate: vi.fn(async (_args: unknown) => ({ id: "new-pass" })),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: (...args: unknown[]) => mocks.payloadFindById(...(args as [{ collection: string }])),
    find: (...args: unknown[]) => mocks.payloadFind(...(args as [{ collection: string }])),
    create: (...args: unknown[]) => mocks.payloadCreate(...(args as [unknown])),
  })),
}));

vi.mock("../../payload.config", () => ({ default: {} }));

vi.mock("../../lib/container", () => ({
  container: {
    pushService: mocks.apnsFake, // alert fan-out (no alert devices -> unused)
    apnsService: mocks.apnsFake, // `.pass` push target under test
    walletPassService: mocks.walletStub,
    smsService: { send: vi.fn(async () => ({ messageId: "m" })) },
    logger: mocks.logger,
  },
}));

import { emitOrderEvent } from "../../lib/notifications/OrderEventEmitter";

interface PassRow {
  id: string;
  serialNumber: string;
  devices?: Array<{ pushToken?: string }>;
}

function configurePayload(deliveredCount: number, pass: PassRow | null) {
  // Order + customer lookups. Customer has no phone -> SMS path is skipped,
  // keeping the assertion surface focused on the `.pass` push.
  mocks.payloadFindById.mockImplementation((args: { collection: string }) => {
    if (args.collection === "orders") return { id: "order-d", customerId: "cust-1" };
    if (args.collection === "customers") return { id: "cust-1", name: "Ravi" };
    return undefined;
  });
  mocks.payloadFind.mockImplementation((args: { collection: string }) => {
    if (args.collection === "devices")
      return { docs: [] }; // no alert / live-activity devices
    if (args.collection === "orders")
      return { totalDocs: deliveredCount, docs: [] }; // delivered-order count
    if (args.collection === "walletPasses") return { docs: pass ? [pass] : [] };
    return { docs: [] };
  });
}

describe("emitOrderEvent .pass push (Task 19.2)", () => {
  beforeEach(() => {
    mocks.passUpdateCalls.length = 0;
    mocks.apnsFake.sendPassUpdate.mockClear();
    mocks.walletStub.createSignedPassUrl.mockClear();
    mocks.payloadFindById.mockReset();
    mocks.payloadFind.mockReset();
    mocks.payloadCreate.mockClear();
  });

  it("fires a .pass push per registered device with the updated balance + tier (gold)", async () => {
    configurePayload(6, {
      id: "pass-1",
      serialNumber: "mishran-loyalty-cust-1",
      devices: [{ pushToken: "pt-1" }, { pushToken: "pt-2" }],
    });

    await emitOrderEvent("order-d", "delivered");

    expect(mocks.apnsFake.sendPassUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.passUpdateCalls).toEqual([
      {
        deviceToken: "pt-1",
        serialNumber: "mishran-loyalty-cust-1",
        fields: { balanceLabel: "6", tier: "gold" },
      },
      {
        deviceToken: "pt-2",
        serialNumber: "mishran-loyalty-cust-1",
        fields: { balanceLabel: "6", tier: "gold" },
      },
    ]);
  });

  it("reports silver tier + correct balance for 3 delivered orders", async () => {
    configurePayload(3, {
      id: "pass-1",
      serialNumber: "mishran-loyalty-cust-1",
      devices: [{ pushToken: "pt-1" }],
    });

    await emitOrderEvent("order-d", "delivered");

    expect(mocks.passUpdateCalls).toHaveLength(1);
    expect(mocks.passUpdateCalls[0]!.fields).toEqual({ balanceLabel: "3", tier: "silver" });
  });

  it("sends no push when the pass exists but has no registered devices", async () => {
    configurePayload(6, { id: "pass-1", serialNumber: "mishran-loyalty-cust-1", devices: [] });

    await emitOrderEvent("order-d", "delivered");

    expect(mocks.apnsFake.sendPassUpdate).not.toHaveBeenCalled();
    // existing pass -> no mint either
    expect(mocks.walletStub.createSignedPassUrl).not.toHaveBeenCalled();
  });

  it("mints a new pass (no devices yet) instead of pushing when none exists", async () => {
    configurePayload(6, null);

    await emitOrderEvent("order-d", "delivered");

    expect(mocks.apnsFake.sendPassUpdate).not.toHaveBeenCalled();
    expect(mocks.walletStub.createSignedPassUrl).toHaveBeenCalledOnce();
  });

  it("does not swallow a per-device push failure — logs + continues to next device", async () => {
    configurePayload(6, {
      id: "pass-1",
      serialNumber: "mishran-loyalty-cust-1",
      devices: [{ pushToken: "pt-1" }, { pushToken: "pt-2" }],
    });
    // First send throws; the emitter must catch + still attempt the second.
    mocks.apnsFake.sendPassUpdate
      .mockRejectedValueOnce(new Error("APNS down"))
      .mockResolvedValueOnce(undefined);

    await expect(emitOrderEvent("order-d", "delivered")).resolves.toBeUndefined();
    expect(mocks.apnsFake.sendPassUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.logger.error).toHaveBeenCalled();
  });
});
