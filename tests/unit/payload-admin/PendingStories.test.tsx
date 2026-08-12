import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {PendingStories} from "@/components/payload-admin/dashboard/PendingStories";

describe("PendingStories", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 5 skeleton rows while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<PendingStories />);
    expect(screen.getAllByTestId("skeleton-row").length).toBe(5);
  });

  it("renders pending stories with relative time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [
        {id: "1", name: "Festive Kaju Story", pillar: "mithai", updatedAt: "2026-08-09T12:00:00Z"},
      ]}),
    }));
    render(<PendingStories />);
    await waitFor(() => {
      expect(screen.getByText("Festive Kaju Story")).toBeInTheDocument();
      expect(screen.getByText(/days? ago/i)).toBeInTheDocument();
    });
  });

  it("renders empty state when no drafts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: []}),
    }));
    render(<PendingStories />);
    await waitFor(() => {
      expect(screen.getByText(/No pending drafts/i)).toBeInTheDocument();
    });
  });

  it("renders error message on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<PendingStories />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load stories/i)).toBeInTheDocument();
    });
  });
});
