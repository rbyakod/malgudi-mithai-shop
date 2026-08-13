// lib/notifications/impl/ApnsPushService.test.ts
// APNs adapter tests — Task 18.4.
//
// @parse/node-apn is mocked wholesale (it is not installed — prod-only dep,
// gated behind a dynamic import). The mock captures the Notification config
// and the provider.send calls so tests assert the exact APNs payload shape:
// `.liveactivity` push type, `content-state` body, `stale-date`, and
// `dismissal-date` for terminal stages. Gating (absent lib → clear error) is
// covered in ApnsPushService.gating.test.ts (no mock, real failed import).

import { describe, it, expect, beforeEach, vi } from "vitest";

const { providerSend, builtNotes } = vi.hoisted(() => ({
  // The provider's send spy — resolves to a sent:true result by default.
  providerSend: vi.fn(),
  // Captures every Notification config object the service constructs.
  builtNotes: [] as Array<Record<string, unknown>>,
}));

vi.mock("@parse/node-apn", () => {
  class MockNotification {
    constructor(config?: Record<string, unknown>) {
      builtNotes.push(config ?? {});
      Object.assign(this, config ?? {});
    }
  }
  class MockProvider {
    send = providerSend;
  }
  return { Notification: MockNotification, Provider: MockProvider };
});

import { ApnsPushService } from "./ApnsPushService";

const opts = {
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
  bundleId: "com.mishran.app",
  production: false,
};

describe("ApnsPushService.sendLiveActivityUpdate", () => {
  beforeEach(() => {
    providerSend.mockReset();
    builtNotes.length = 0;
    providerSend.mockResolvedValue({ sent: true });
  });

  it("sends a .liveactivity push with content-state + stale-date", async () => {
    const svc = new ApnsPushService(opts);
    const updatedAt = "2026-08-13T10:00:00.000Z";
    await svc.sendLiveActivityUpdate("activity-token-1", {
      status: "dispatched",
      statusLabel: "push.order.dispatched.title",
      body: "push.order.dispatched.body",
      updatedAt,
    });

    const note = builtNotes[builtNotes.length - 1]!;
    expect(note.pushType).toBe("liveactivity");
    expect(note.topic).toBe("com.mishran.app");
    expect(note.priority).toBe(5);
    const payload = note.payload as Record<string, unknown>;
    const contentState = payload["content-state"] as Record<string, string>;
    expect(contentState.status).toBe("dispatched");
    expect(contentState.statusLabel).toBe("push.order.dispatched.title");
    // stale-date is epoch seconds derived from updatedAt + 1h default window.
    expect(note.staleDate).toBe(Math.floor(new Date(updatedAt).getTime() / 1000) + 3600);
    // sent to the ActivityKit token.
    expect(providerSend).toHaveBeenCalledOnce();
    expect(providerSend.mock.calls[0]![1]).toBe("activity-token-1");
  });

  it("sets dismissal-date when a dismissalDate option is provided (terminal)", async () => {
    const svc = new ApnsPushService(opts);
    const dismissal = new Date("2026-08-13T12:00:00.000Z");
    await svc.sendLiveActivityUpdate(
      "tok",
      {
        status: "delivered",
        statusLabel: "push.order.delivered.title",
        body: "push.order.delivered.body",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
      { dismissalDate: dismissal },
    );
    const note = builtNotes[builtNotes.length - 1]!;
    const payload = note.payload as Record<string, unknown>;
    expect(payload["dismissal-date"]).toBe(Math.floor(dismissal.getTime() / 1000));
  });

  it("honors an explicit staleDate override", async () => {
    const svc = new ApnsPushService(opts);
    const stale = new Date("2026-08-13T11:00:00.000Z");
    await svc.sendLiveActivityUpdate(
      "tok",
      {
        status: "packed",
        statusLabel: "push.order.packed.title",
        body: "push.order.packed.body",
        updatedAt: "2026-08-13T10:00:00.000Z",
      },
      { staleDate: stale },
    );
    const note = builtNotes[builtNotes.length - 1]!;
    expect(note.staleDate).toBe(Math.floor(stale.getTime() / 1000));
  });

  it("propagates provider.send rejections", async () => {
    providerSend.mockRejectedValue(new Error("BadDeviceToken"));
    const svc = new ApnsPushService(opts);
    await expect(
      svc.sendLiveActivityUpdate("tok", {
        status: "packed",
        statusLabel: "t",
        body: "b",
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("BadDeviceToken");
  });
});

describe("ApnsPushService.sendToTokens (alert)", () => {
  beforeEach(() => {
    providerSend.mockReset();
    builtNotes.length = 0;
    providerSend.mockResolvedValue({ sent: true });
  });

  it("sends an .alert push per token + classifies success/failure", async () => {
    providerSend
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ failed: { status: "410" } });
    const svc = new ApnsPushService(opts);
    const result = await svc.sendToTokens({
      tokens: ["good", "bad"],
      title: "push.order.confirmed.title",
      body: "push.order.confirmed.body",
      data: { orderId: "o1" },
    });
    expect(result.success).toEqual(["good"]);
    expect(result.failed).toEqual([{ token: "bad", reason: "apns rejected token" }]);
    const note = builtNotes[0] as Record<string, unknown>;
    expect(note.pushType).toBe("alert");
    expect(note.topic).toBe("com.mishran.app");
  });
});
