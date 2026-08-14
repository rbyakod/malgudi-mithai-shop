// lib/notifications/impl/FcmPushService.test.ts
// FCM push adapter tests — Task 5.2.
//
// firebase-admin is mocked wholesale: tests never touch a real Firebase
// project. The mock captures the message passed to sendEachForMulticast and
// returns a programmable response vector (one entry per token, success/fail).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock firebase-admin. vi.hoisted() lifts the spy fns + the apps holder to
// the same hoisted phase as vi.mock, so the factory can reference them and
// tests can reset them in beforeEach.
// ---------------------------------------------------------------------------

const { mocks, apps } = vi.hoisted(() => {
  const apps: unknown[] = [];
  return {
    apps,
    mocks: {
      sendEachForMulticast: vi.fn(),
      initializeApp: vi.fn(),
      cert: vi.fn(),
      applicationDefault: vi.fn(),
    },
  };
});

vi.mock("firebase-admin", () => ({
  // firebase-admin v14 exposes named exports (initializeApp, getApps, cert,
  // applicationDefault) — no default namespace. The mock mirrors that shape.
  getApps() {
    return apps;
  },
  initializeApp(opts: unknown) {
    mocks.initializeApp(opts);
    const app = { __opts: opts };
    apps.push(app);
    return app;
  },
  cert: (raw: unknown) => mocks.cert(raw),
  applicationDefault: () => mocks.applicationDefault(),
}));

// v14 split messaging into the firebase-admin/messaging subpath; the service
// calls getMessaging(app).sendEachForMulticast(...).
vi.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ sendEachForMulticast: mocks.sendEachForMulticast }),
}));

const { mockSendEachForMulticast, mockInitializeApp, mockCert, mockApplicationDefault } = {
  mockSendEachForMulticast: mocks.sendEachForMulticast,
  mockInitializeApp: mocks.initializeApp,
  mockCert: mocks.cert,
  mockApplicationDefault: mocks.applicationDefault,
};

import { FcmPushService } from "./FcmPushService";

function buildResponseVector(results: { success?: boolean; error?: string }[]) {
  return {
    responses: results.map((r) => ({
      success: r.success ?? false,
      error: r.error ? { message: r.error } : undefined,
    })),
  };
}

describe("FcmPushService", () => {
  beforeEach(() => {
    mockSendEachForMulticast.mockReset();
    mockInitializeApp.mockReset();
    mockCert.mockReset();
    mockApplicationDefault.mockReset();
    // Clear the hoisted apps array in place (the mock getter returns the
    // same reference) so each test re-initializes a fresh Firebase app.
    apps.length = 0;
  });

  it("initializes with serviceAccountJson when provided", async () => {
    mockSendEachForMulticast.mockResolvedValue(buildResponseVector([{ success: true }]));
    const svc = new FcmPushService({
      projectId: "proj",
      serviceAccountJson: JSON.stringify({ project_id: "proj", private_key: "k", client_email: "e" }),
    });
    await svc.sendToTokens({ tokens: ["t1"], title: "T", body: "B", data: {} });
    expect(mockCert).toHaveBeenCalledOnce();
    expect(mockApplicationDefault).not.toHaveBeenCalled();
  });

  it("falls back to applicationDefault when serviceAccountJson omitted", async () => {
    mockSendEachForMulticast.mockResolvedValue(buildResponseVector([{ success: true }]));
    const svc = new FcmPushService({ projectId: "proj" });
    await svc.sendToTokens({ tokens: ["t1"], title: "T", body: "B", data: {} });
    expect(mockApplicationDefault).toHaveBeenCalledOnce();
    expect(mockCert).not.toHaveBeenCalled();
  });

  it("returns success tokens and failed reasons on a mixed batch", async () => {
    mockSendEachForMulticast.mockResolvedValue(
      buildResponseVector([
        { success: true },
        { success: false, error: "registration-token-not-registered" },
        { success: true },
        { success: false, error: "invalid-argument" },
      ]),
    );
    const svc = new FcmPushService({ projectId: "proj" });
    const result = await svc.sendToTokens({
      tokens: ["t1", "t2", "t3", "t4"],
      title: "T",
      body: "B",
      data: { orderId: "o1", stage: "confirmed" },
    });
    expect(result.success).toEqual(["t1", "t3"]);
    expect(result.failed).toEqual([
      { token: "t2", reason: "registration-token-not-registered" },
      { token: "t4", reason: "invalid-argument" },
    ]);
  });

  it("reports all tokens failed when every response is unsuccessful", async () => {
    mockSendEachForMulticast.mockResolvedValue(
      buildResponseVector([
        { success: false, error: "unavailable" },
        { success: false }, // unknown reason path
      ]),
    );
    const svc = new FcmPushService({ projectId: "proj" });
    const result = await svc.sendToTokens({ tokens: ["a", "b"], title: "T", body: "B", data: {} });
    expect(result.success).toEqual([]);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].reason).toBe("unavailable");
    expect(result.failed[1].reason).toBe("unknown");
  });

  it("passes title, body, data, and tokens through to messaging().sendEachForMulticast", async () => {
    mockSendEachForMulticast.mockResolvedValue(buildResponseVector([{ success: true }]));
    const svc = new FcmPushService({ projectId: "proj" });
    await svc.sendToTokens({
      tokens: ["tok"],
      title: "push.order.confirmed.title",
      body: "push.order.confirmed.body",
      data: { orderId: "o1", stage: "confirmed", event_id: "ev1" },
    });
    expect(mockSendEachForMulticast).toHaveBeenCalledOnce();
    const arg = mockSendEachForMulticast.mock.calls[0][0];
    expect(arg.notification).toEqual({ title: "push.order.confirmed.title", body: "push.order.confirmed.body" });
    expect(arg.data).toEqual({ orderId: "o1", stage: "confirmed", event_id: "ev1" });
    expect(arg.tokens).toEqual(["tok"]);
  });
});
