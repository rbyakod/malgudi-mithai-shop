// app/api/health/route.test.ts
// Health endpoint tests — Task 5.6.
//
// mongodb.MongoClient is mocked so we can drive both the ok and down paths
// without a live database. The config module is mocked to avoid the required-
// env schema.parse crash in the test environment.
import { describe, it, expect, beforeEach, vi } from "vitest";

const { connect, close, command } = vi.hoisted(() => ({
  connect: vi.fn(),
  close: vi.fn(),
  command: vi.fn(),
}));

vi.mock("mongodb", () => ({
  // Real class so the route's `new MongoClient(...)` constructs cleanly.
  // (An arrow-function mockImplementation cannot be used with `new`.)
  MongoClient: class {
    connect = connect;
    close = close;
    db() {
      return { command };
    }
  },
}));

vi.mock("../../../lib/config", () => ({
  config: { mongoUri: "mongodb://test/test" },
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    connect.mockReset();
    close.mockReset();
    command.mockReset();
  });

  it("200 ok when mongo ping succeeds", async () => {
    connect.mockResolvedValue(undefined);
    command.mockResolvedValue({ ok: 1 });
    close.mockResolvedValue(undefined);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.mongo).toBe("ok");
    expect(body.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("503 degraded when mongo is down", async () => {
    connect.mockRejectedValue(new Error("connection refused"));

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.mongo).toBe("down");
  });
});
