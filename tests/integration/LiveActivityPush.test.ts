// tests/integration/LiveActivityPush.test.ts
// Live Activity push integration — Task 18.4.
//
// Exercises the REAL OrderEventEmitter against an in-memory Payload, with a
// FakePushService standing in for both container.pushService (alert) and
// container.apnsService (Live Activity). Asserts the spec §8.8 contract:
//   - iOS device with an ActivityKit token receives a `.liveactivity`
//     content-state update carrying the stage + i18n keys + timestamp.
//   - Android device receives the alert push but NO Live Activity update.
//   - Terminal stage ('delivered') attaches a dismissalDate (ends activity).

import { describe, it, expect, beforeEach, vi } from "vitest";

// Self-contained recording fakes defined inside vi.hoisted so the container
// mock factory and the test body share the SAME instance without importing
// FakePushService (the import binding is uninitialized during the hoisted
// phase — TDZ). Mirrors the FakePushService shape (calls + liveActivityCalls).
const { stores, pushService, apnsService } = vi.hoisted(() => {
  interface RecordedCall {
    tokens: string[];
    title: string;
    body: string;
    data: Record<string, string>;
  }
  interface RecordedLiveActivity {
    deviceToken: string;
    contentState: Record<string, unknown>;
    options?: { staleDate?: Date; dismissalDate?: Date };
  }
  function makeFakePush() {
    const calls: RecordedCall[] = [];
    const liveActivityCalls: RecordedLiveActivity[] = [];
    return {
      calls,
      liveActivityCalls,
      async sendToTokens(message: {
        tokens: string[];
        title: string;
        body: string;
        data: Record<string, string>;
      }) {
        calls.push({
          tokens: [...message.tokens],
          title: message.title,
          body: message.body,
          data: { ...message.data },
        });
        return { success: [...message.tokens], failed: [] };
      },
      async sendLiveActivityUpdate(
        deviceToken: string,
        contentState: Record<string, unknown>,
        options?: { staleDate?: Date; dismissalDate?: Date },
      ) {
        liveActivityCalls.push({ deviceToken, contentState, options });
      },
    };
  }
  return {
    stores: {
      orders: new Map<string, Record<string, unknown>>(),
      customers: new Map<string, Record<string, unknown>>(),
      devices: new Map<string, Record<string, unknown>>(),
    },
    pushService: makeFakePush(),
    apnsService: makeFakePush(),
  };
});

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    findByID: vi.fn(
      async ({ collection, id }: { collection: string; id: string }) =>
        (stores as Record<string, Map<string, Record<string, unknown>>>)[collection].get(
          String(id),
        ) ?? null,
    ),
    find: vi.fn(
      async ({
        collection,
        where,
      }: {
        collection: string;
        where?: Record<string, unknown>;
      }) => {
        const col = (stores as Record<string, Map<string, Record<string, unknown>>>)[collection];
        const all = col ? Array.from(col.values()) : [];
        // Minimal `and` matcher — enough for the devices query
        // (customerId + active). `equals` semantics.
        const docs = all.filter((d) => {
          if (!where) return true;
          const and = (where as { and?: Array<Record<string, unknown>> }).and;
          if (and) {
            return and.every((clause) =>
              Object.entries(clause).every(([field, cond]) => {
                const eq = (cond as { equals?: unknown }).equals;
                return eq !== undefined ? d[field] === eq : true;
              }),
            );
          }
          return Object.entries(where).every(([field, cond]) => {
            const eq = (cond as { equals?: unknown }).equals;
            return eq !== undefined ? d[field] === eq : true;
          });
        });
        return { docs, totalDocs: docs.length };
      },
    ),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
  })),
}));

vi.mock("../../payload.config", () => ({ default: {} }));

vi.mock("../../lib/container", () => ({
  container: {
    pushService,
    apnsService,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

import { emitOrderEvent } from "../../lib/notifications/OrderEventEmitter";

function seedOrder(customerId: string): string {
  const orderId = "order-1";
  stores.orders.set(orderId, { id: orderId, customerId });
  stores.customers.set(customerId, {
    id: customerId,
    phone: "+919999900000",
    locale: "en",
  });
  // iOS device with an active Live Activity token.
  stores.devices.set("dev-ios", {
    id: "dev-ios",
    customerId,
    active: true,
    platform: "ios",
    pushToken: "ios-alert-token",
    liveActivityToken: "activity-token-ios",
  });
  // Android device — no Live Activity.
  stores.devices.set("dev-android", {
    id: "dev-android",
    customerId,
    active: true,
    platform: "android",
    pushToken: "fcm-token",
  });
  return orderId;
}

describe("emitOrderEvent → Live Activity push", () => {
  beforeEach(() => {
    stores.orders.clear();
    stores.customers.clear();
    stores.devices.clear();
    pushService.calls.length = 0;
    pushService.liveActivityCalls.length = 0;
    apnsService.calls.length = 0;
    apnsService.liveActivityCalls.length = 0;
  });

  it("fires a .liveactivity content-state update to the iOS device only", async () => {
    const orderId = seedOrder("cust-1");
    await emitOrderEvent(orderId, "dispatched");

    // Alert push fanned out to BOTH device tokens.
    expect(pushService.calls).toHaveLength(1);
    expect(pushService.calls[0]!.tokens).toContain("ios-alert-token");
    expect(pushService.calls[0]!.tokens).toContain("fcm-token");

    // Live Activity update fired ONCE — iOS device only.
    expect(apnsService.liveActivityCalls).toHaveLength(1);
    const update = apnsService.liveActivityCalls[0]!;
    expect(update.deviceToken).toBe("activity-token-ios");
    expect(update.contentState.status).toBe("dispatched");
    expect(update.contentState.statusLabel).toBe("push.order.dispatched.title");
    expect(update.contentState.body).toBe("push.order.dispatched.body");
    expect(update.contentState.updatedAt).toBeTruthy();
    // Non-terminal → no dismissal.
    expect(update.options?.dismissalDate).toBeUndefined();
  });

  it("attaches a dismissalDate on the terminal 'delivered' stage", async () => {
    const orderId = seedOrder("cust-2");
    await emitOrderEvent(orderId, "delivered");

    expect(apnsService.liveActivityCalls).toHaveLength(1);
    const update = apnsService.liveActivityCalls[0]!;
    expect(update.contentState.status).toBe("delivered");
    expect(update.options?.dismissalDate).toBeInstanceOf(Date);
  });

  it("skips Live Activity when no iOS device carries an ActivityKit token", async () => {
    const orderId = "order-2";
    stores.orders.set(orderId, { id: orderId, customerId: "cust-3" });
    stores.customers.set("cust-3", { id: "cust-3", phone: "+919999911111", locale: "en" });
    // Android only.
    stores.devices.set("dev-a", {
      id: "dev-a",
      customerId: "cust-3",
      active: true,
      platform: "android",
      pushToken: "fcm-only",
    });
    await emitOrderEvent(orderId, "packed");

    expect(apnsService.liveActivityCalls).toHaveLength(0);
    // Alert still fires.
    expect(pushService.calls).toHaveLength(1);
  });

  it("is a no-op for an untracked stage (no template)", async () => {
    const orderId = seedOrder("cust-4");
    await emitOrderEvent(orderId, "created");
    expect(apnsService.liveActivityCalls).toHaveLength(0);
    expect(pushService.calls).toHaveLength(0);
  });
});
