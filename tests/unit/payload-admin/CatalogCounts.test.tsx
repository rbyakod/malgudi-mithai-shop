import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {CatalogCounts} from "@/components/payload-admin/dashboard/CatalogCounts";

describe("CatalogCounts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 5 skeleton cards while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<CatalogCounts />);
    expect(screen.getAllByTestId("skeleton-card").length).toBe(5);
  });

  it("renders 5 cards with counts when resolved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((path: string) => Promise.resolve({
      ok: true,
      json: async () => {
        if (path.includes("mithai-products")) return {totalDocs: 42};
        if (path.includes("qsr-menu-items")) return {totalDocs: 18};
        if (path.includes("snack-products")) return {totalDocs: 7};
        if (path.includes("merch-products")) return {totalDocs: 3};
        if (path.includes("gift-boxes")) return {totalDocs: 12};
        return {totalDocs: 0};
      },
    })));
    render(<CatalogCounts />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("18")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });

  it("renders '—' on individual fetch failure, others succeed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((path: string) => {
      if (path.includes("mithai-products")) {
        return Promise.resolve({ok: false, status: 500, statusText: "Internal Server Error"});
      }
      return Promise.resolve({ok: true, json: async () => ({totalDocs: 5})});
    }));
    render(<CatalogCounts />);
    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });
});
