// lib/notifications/impl/ApnsPushService.gating.test.ts
// APNs gating tests — Task 18.4.
//
// @parse/node-apn is NOT mocked here. The prod-only dep is absent on lean
// boxes (CI), so the service's dynamic `import(/* @vite-ignore */ "@parse/
// node-apn")` rejects at runtime, hits the catch, and re-throws the clear,
// actionable error. This is the same gating pattern proven for node-passbook
// (Task 18.5) — it lets the container resolve `apnsService` to FakePushService
// so a box without APNs creds never attempts an unreachable APNs call.
//
// On machines where @parse/node-apn IS installed (e.g. the dev box that
// exercised real Live Activities), the import succeeds and the flow instead
// dies in node-apn's Provider constructor — the fake PEM is not a usable
// ES256 key. Both environments fail fast with an actionable error; the test
// asserts whichever failure this box produces, so it is honest everywhere.

import { describe, it, expect } from "vitest";
import { ApnsPushService } from "./ApnsPushService";

const opts = {
  teamId: "TEAM123456",
  keyId: "KEY1234567",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
  bundleId: "com.mishran.app",
};

/** Absent dep → the service's gating message; present → node-apn's key error. */
const failurePattern: RegExp = await (async () => {
  try {
    await import("@parse/node-apn");
    return /Failed to generate token/;
  } catch {
    return /@parse\/node-apn is not installed/;
  }
})();

describe("ApnsPushService gating (@parse/node-apn absent)", () => {
  it("sendLiveActivityUpdate fails fast with a clear error", async () => {
    const svc = new ApnsPushService(opts);
    await expect(
      svc.sendLiveActivityUpdate("tok", {
        status: "packed",
        statusLabel: "t",
        body: "b",
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(failurePattern);
  });

  it("sendToTokens fails the same way", async () => {
    const svc = new ApnsPushService(opts);
    await expect(
      svc.sendToTokens({ tokens: ["t1"], title: "T", body: "B", data: {} }),
    ).rejects.toThrow(failurePattern);
  });
});
