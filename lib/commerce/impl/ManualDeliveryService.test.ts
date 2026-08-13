// lib/commerce/impl/ManualDeliveryService.test.ts
// Tests for ManualDeliveryService — Task 5.1 (Mishran Mobile Apps v1).
//
// Payload is mocked with an in-memory store. Only the `shipments` collection
// is exercised here (ManualDeliveryService never touches `orders`).
import { describe, it, expect, vi, beforeEach } from "vitest";

const { stores } = vi.hoisted(() => ({
  stores: {
    shipments: new Map<string, Record<string, unknown>>(),
  },
}));

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    find: vi.fn(async ({ where }: { where: { orderId?: { equals?: string } } }) => {
      const orderId = where?.orderId?.equals;
      if (!orderId) return { docs: [] };
      const doc = Array.from(stores.shipments.values()).find(
        (d) => d.orderId === orderId,
      );
      return { docs: doc ? [doc] : [] };
    }),
    create: vi.fn(
      async ({ data }: { data: Record<string, unknown> }) => {
        const id = `ship-${stores.shipments.size + 1}`;
        const doc = { id, ...data };
        stores.shipments.set(id, doc);
        return doc;
      },
    ),
  })),
}));

vi.mock("../../../payload.config", () => ({ default: {} }));

import { ManualDeliveryService } from "./ManualDeliveryService";

function resetStores() {
  stores.shipments.clear();
}

describe("ManualDeliveryService", () => {
  beforeEach(resetStores);

  describe("createShipment", () => {
    it("writes a Shipments row with currentStage='confirmed' and an initial history entry", async () => {
      const svc = new ManualDeliveryService();
      const res = await svc.createShipment({ orderId: "order-1" });

      // manual flow: no provider id
      expect(res.providerShipmentId).toBeUndefined();

      const row = Array.from(stores.shipments.values()).find(
        (d) => d.orderId === "order-1",
      );
      expect(row).toBeDefined();
      expect(row!.currentStage).toBe("confirmed");
      expect(Array.isArray(row!.history)).toBe(true);
      expect(row!.history).toHaveLength(1);
      const entry = (row!.history as Array<Record<string, unknown>>)[0]!;
      expect(entry.stage).toBe("confirmed");
      expect(entry.at).toEqual(expect.any(String));
    });

    it("is idempotent — calling twice for the same order does not create a second row", async () => {
      const svc = new ManualDeliveryService();
      await svc.createShipment({ orderId: "order-1" });
      await svc.createShipment({ orderId: "order-1" });

      const matching = Array.from(stores.shipments.values()).filter(
        (d) => d.orderId === "order-1",
      );
      expect(matching).toHaveLength(1);
    });
  });

  describe("trackShipment", () => {
    it("returns the row's currentStage and history when a shipment exists", async () => {
      const svc = new ManualDeliveryService();
      await svc.createShipment({ orderId: "order-1" });

      const tracking = await svc.trackShipment("order-1");
      expect(tracking.currentStage).toBe("confirmed");
      expect(tracking.history).toHaveLength(1);
      expect(tracking.history[0]!.stage).toBe("confirmed");
    });

    it("returns synthetic {currentStage:'confirmed', history:[]} when no row exists (no throw)", async () => {
      const svc = new ManualDeliveryService();
      const tracking = await svc.trackShipment("order-without-shipment");
      expect(tracking).toEqual({ currentStage: "confirmed", history: [] });
    });
  });
});
