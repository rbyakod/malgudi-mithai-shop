// lib/notifications/impl/ApnsPushService.gating.test.ts
// APNs gating tests — Task 18.4.
//
// @parse/node-apn is NOT mocked here. The prod-only dep is absent in this
// environment, so the service's dynamic `import(/* @vite-ignore */ "@parse/
// node-apn")` rejects at runtime, hits the catch, and re-throws the clear,
// actionable error. This is the same gating pattern proven for node-passbook
// (Task 18.5) — it lets the container resolve `apnsService` to FakePushService
// so a box without APNs creds never attempts an unreachable APNs call.

import { describe, it, expect } from "vitest";
import { ApnsPushService } from "./ApnsPushService";

const opts = {
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
  bundleId: "com.mishran.app",
};

describe("ApnsPushService gating (@parse/node-apn absent)", () => {
  it("sendLiveActivityUpdate throws a clear 'not installed' error", async () => {
    const svc = new ApnsPushService(opts);
    await expect(
      svc.sendLiveActivityUpdate("tok", {
        status: "packed",
        statusLabel: "t",
        body: "b",
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/@parse\/node-apn is not installed/);
  });

  it("sendToTokens throws the same gating error", async () => {
    const svc = new ApnsPushService(opts);
    await expect(
      svc.sendToTokens({ tokens: ["t1"], title: "T", body: "B", data: {} }),
    ).rejects.toThrow(/@parse\/node-apn is not installed/);
  });
});
