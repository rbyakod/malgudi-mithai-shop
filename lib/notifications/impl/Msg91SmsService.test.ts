// lib/notifications/impl/Msg91SmsService.test.ts
// MSG91 SMS adapter tests — Task 5.2.
//
// HTTP mocked via nock — same pattern as Msg91OtpService.test.ts. The SMS
// send endpoint is POST https://api.msg91.com/api/v5/sms/send with a JSON
// body. Template IDs are resolved from the per-stage map the service is
// constructed with.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { Msg91SmsService } from "./Msg91SmsService";

const TEMPLATE_MAP = {
  "sms.order.confirmed.body": "CONFIRMED_TEMPLATE_ID",
  "sms.order.dispatched.body": "DISPATCHED_TEMPLATE_ID",
};

describe("Msg91SmsService", () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.enableNetConnect());

  it("posts to /api/v5/sms/send and returns the messageId", async () => {
    const body = { message: "msg-abc", type: "success" };
    nock("https://api.msg91.com")
      .post("/api/v5/sms/send")
      .reply(200, body);

    const svc = new Msg91SmsService({
      authKey: "k",
      senderId: "MISHRN",
      templateIds: TEMPLATE_MAP,
    });
    const result = await svc.send({
      phone: "+919999999999",
      templateKey: "sms.order.confirmed.body",
      vars: { id: "abcd1234" },
    });
    expect(result.messageId).toBe("msg-abc");
  });

  it("includes sender, route, authkey header, and the resolved template id in the body", async () => {
    let captured: Record<string, unknown> = {};
    nock("https://api.msg91.com")
      .post("/api/v5/sms/send", (b) => {
        captured = b as Record<string, unknown>;
        return true;
      })
      .reply(200, { message: "msg-2", type: "success" });

    const svc = new Msg91SmsService({
      authKey: "key123",
      senderId: "MISHRN",
      templateIds: TEMPLATE_MAP,
    });
    await svc.send({
      phone: "+919999999999",
      templateKey: "sms.order.dispatched.body",
      vars: { id: "1234" },
    });

    expect(captured.key).toBe("key123");
    expect(captured.sender).toBe("MISHRN");
    expect(captured.route).toBe(4);
    expect(captured.sms).toBeDefined();
    const sms = (captured.sms as Array<Record<string, unknown>>)[0];
    expect(sms.template_id).toBe("DISPATCHED_TEMPLATE_ID");
    expect(sms.to).toEqual(["+919999999999"]);
  });

  it("throws on non-2xx response", async () => {
    nock("https://api.msg91.com").post("/api/v5/sms/send").reply(500, "boom");
    const svc = new Msg91SmsService({
      authKey: "k",
      senderId: "MISHRN",
      templateIds: TEMPLATE_MAP,
    });
    await expect(
      svc.send({
        phone: "+919999999999",
        templateKey: "sms.order.confirmed.body",
        vars: {},
      }),
    ).rejects.toThrow(/MSG91 SMS send failed: 500/);
  });

  it("throws when no template is registered for the templateKey", async () => {
    const svc = new Msg91SmsService({
      authKey: "k",
      senderId: "MISHRN",
      templateIds: TEMPLATE_MAP,
    });
    await expect(
      svc.send({
        phone: "+919999999999",
        templateKey: "sms.order.unknown.body",
        vars: {},
      }),
    ).rejects.toThrow(/no MSG91 template/);
  });
});
