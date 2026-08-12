import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MishranDashboard} from "@/components/payload-admin/dashboard/MishranDashboard";

describe("MishranDashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 4 widget headings in a 2x2 grid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [], totalDocs: 0}),
    }));
    render(<MishranDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Recent leads")).toBeInTheDocument();
      expect(screen.getByText("Mithai freshness")).toBeInTheDocument();
      expect(screen.getByText("Pending stories")).toBeInTheDocument();
      expect(screen.getByText("Catalog")).toBeInTheDocument();
    });
  });

  it("renders mishran-dashboard container class", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [], totalDocs: 0}),
    }));
    const {container} = render(<MishranDashboard />);
    expect(container.querySelector(".mishran-dashboard")).not.toBeNull();
  });
});
