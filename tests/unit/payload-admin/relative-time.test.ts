import {describe, it, expect} from "vitest";
import {formatRelativeTime} from "@/components/payload-admin/lib/relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("returns 'just now' for < 60 seconds", () => {
    const d = new Date("2026-08-11T11:59:30Z");
    expect(formatRelativeTime(d, now)).toBe("just now");
  });

  it("returns minutes for < 60 min", () => {
    const d = new Date("2026-08-11T11:30:00Z");
    expect(formatRelativeTime(d, now)).toBe("30 minutes ago");
  });

  it("returns singular 'minute' for 1 min", () => {
    const d = new Date("2026-08-11T11:59:00Z");
    expect(formatRelativeTime(d, now)).toBe("1 minute ago");
  });

  it("returns hours for < 24h", () => {
    const d = new Date("2026-08-11T06:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("6 hours ago");
  });

  it("returns singular 'hour' for 1h", () => {
    const d = new Date("2026-08-11T11:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("1 hour ago");
  });

  it("returns days for >= 24h", () => {
    const d = new Date("2026-08-09T12:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("2 days ago");
  });

  it("returns singular 'day' for 1 day", () => {
    const d = new Date("2026-08-10T12:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("1 day ago");
  });

  it("accepts ISO date string", () => {
    expect(formatRelativeTime("2026-08-09T12:00:00Z", now)).toBe("2 days ago");
  });

  it("returns 'in the future' for future dates (defensive)", () => {
    const d = new Date("2026-08-12T12:00:00Z");
    expect(formatRelativeTime(d, now)).toBe("in the future");
  });
});
