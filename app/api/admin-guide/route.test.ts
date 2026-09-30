// app/api/admin-guide/route.test.ts
// The bridge from the shop admin to the agent service's explain-only Admin Guide. Covers who may ask, that the
// token never leaves the server, and what is forwarded. Mocks the admin-auth helper and fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { adminUser } = vi.hoisted(() => ({ adminUser: vi.fn() }));
vi.mock("../../../lib/api/adminAuth", () => ({ getPayloadAdminUser: adminUser }));

import { POST } from "./route";

const TOKEN = "s".repeat(40);
const ORIGINAL_ENV = { ...process.env };

function req(body: unknown, headers: Record<string, string> = { "x-requested-with": "admin-guide" }) {
  return new NextRequest("http://localhost/api/admin-guide", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/admin-guide", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.AGENT_SERVICE_URL = "http://127.0.0.1:3082/api/team-admin";
    process.env.AGENT_GUIDE_TOKEN = TOKEN;
    delete process.env.ADMIN_GUIDE_ROLES;
    adminUser.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("refuses a request without the widget's header, before touching auth", async () => {
    const res = await POST(req({ message: "hi" }, {}));
    expect(res.status).toBe(403);
    expect(adminUser).not.toHaveBeenCalled();
  });

  it("refuses someone who is not signed in to the admin", async () => {
    adminUser.mockResolvedValue(undefined);
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows only the owner role by default, and staff once the roles are widened", async () => {
    adminUser.mockResolvedValue({ id: "u2", role: "editor" });
    expect((await POST(req({ message: "hi" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.ADMIN_GUIDE_ROLES = "admin,editor";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: "ok" }), { status: 200 }));
    expect((await POST(req({ message: "hi" }))).status).toBe(200);
  });

  it("says so plainly when the server is not set up", async () => {
    adminUser.mockResolvedValue({ id: "u1", role: "admin" });
    delete process.env.AGENT_GUIDE_TOKEN;
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(503);
  });

  it("forwards a cleaned question with the token, and never returns the token", async () => {
    adminUser.mockResolvedValue({ id: "u1", role: "admin", email: "owner@example.com" });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ text: "It sets the fee.", model: "m" }), { status: 200 }));
    const res = await POST(req({ message: "What is this?", history: [{ role: "system", content: "bad" }, { role: "user", content: "q" }], page: "/admin/globals/x", secret: "no" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "It sets the fee." });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:3082/api/team-admin/guide/chat");
    expect(init.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.headers["x-guide-user"]).toBe("admin:u1");
    const sent = JSON.parse(init.body);
    expect(Object.keys(sent)).toEqual(["message", "history", "page"]);
    expect(sent.history).toEqual([{ role: "user", content: "q" }]);
  });

  it("passes the guide's own errors through, and reports an unreachable service as 502", async () => {
    adminUser.mockResolvedValue({ id: "u1", role: "admin" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Today's limit is used up." }), { status: 429 }));
    const limited = await POST(req({ message: "hi" }));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "Today's limit is used up." });

    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    expect((await POST(req({ message: "hi" }))).status).toBe(502);
  });

  it("rejects an empty or oversized question before calling the guide", async () => {
    adminUser.mockResolvedValue({ id: "u1", role: "admin" });
    expect((await POST(req({ message: "  " }))).status).toBe(400);
    expect((await POST(req("not json"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
