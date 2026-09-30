// lib/admin-guide.test.ts
import { describe, it, expect } from "vitest";
import { cleanGuideRequest, guideConfig, guideRoles, mayUseGuide } from "./admin-guide";

describe("guideRoles / mayUseGuide", () => {
  it("defaults to the owner role only", () => {
    expect(guideRoles(undefined)).toEqual(["admin"]);
    expect(guideRoles("")).toEqual(["admin"]);
    expect(mayUseGuide({ role: "admin" }, guideRoles(undefined))).toBe(true);
    expect(mayUseGuide({ role: "editor" }, guideRoles(undefined))).toBe(false);
    expect(mayUseGuide({ role: "ops" }, guideRoles(undefined))).toBe(false);
  });
  it("lets staff roles in when the owner widens it", () => {
    const roles = guideRoles(" admin , editor,ops ");
    expect(roles).toEqual(["admin", "editor", "ops"]);
    expect(mayUseGuide({ role: "ops" }, roles)).toBe(true);
    expect(mayUseGuide({ role: "customer" }, roles)).toBe(false);
  });
  it("refuses a missing user or a user without a role", () => {
    expect(mayUseGuide(undefined, ["admin"])).toBe(false);
    expect(mayUseGuide({}, ["admin"])).toBe(false);
  });
});

describe("guideConfig", () => {
  const token = "t".repeat(40);
  it("needs both the service address and a token of at least 32 characters", () => {
    expect(guideConfig({ AGENT_SERVICE_URL: "http://127.0.0.1:3082/api/team-admin/", AGENT_GUIDE_TOKEN: token })).toEqual({ url: "http://127.0.0.1:3082/api/team-admin", token });
    expect(guideConfig({ AGENT_SERVICE_URL: "http://x", AGENT_GUIDE_TOKEN: "short" })).toBeNull();
    expect(guideConfig({ AGENT_GUIDE_TOKEN: token })).toBeNull();
    expect(guideConfig({})).toBeNull();
  });
});

describe("cleanGuideRequest", () => {
  it("keeps only the message, a short valid history and the page", () => {
    const out = cleanGuideRequest({
      message: "  What does this do?  ",
      history: [{ role: "system", content: "x" }, { role: "user", content: "q" }, { role: "assistant", content: "a".repeat(3000) }, { role: "user", content: 5 }],
      page: "/admin/x\u0000y",
      extra: "dropped",
    });
    expect(out).not.toBeNull();
    expect(out!.message).toBe("What does this do?");
    expect(out!.history.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(out!.history[1].content.length).toBe(1500);
    expect(out!.page).toBe("/admin/x y");
    expect(Object.keys(out!)).toEqual(["message", "history", "page"]);
  });
  it("rejects empty, oversized or non-object input", () => {
    expect(cleanGuideRequest(null)).toBeNull();
    expect(cleanGuideRequest({ message: "   " })).toBeNull();
    expect(cleanGuideRequest({ message: "x".repeat(2001) })).toBeNull();
    expect(cleanGuideRequest("text")).toBeNull();
  });
});
