import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MithaiFreshnessBoard} from "@/components/payload-admin/dashboard/MithaiFreshnessBoard";

// Mocks the raw Payload `/mithai-products` response (MithaiRow shape — flat,
// not nested like leads). fetchMithaiByFreshness groups by freshnessStatus.
const mockGroups = {
  "made-daily": [
    {id: "1", name: "Kaju Katli", slug: "kaju-katli", freshnessStatus: "made-daily", family: "classic"},
    {id: "2", name: "Rasgulla", slug: "rasgulla", freshnessStatus: "made-daily", family: "classic"},
  ],
  "made-to-order": [
    {id: "3", name: "Motichoor Laddu", slug: "motichoor", freshnessStatus: "made-to-order", family: "classic"},
  ],
  "batch-frozen": [],
};

describe("MithaiFreshnessBoard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 3 skeleton columns while loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<MithaiFreshnessBoard />);
    const skeletons = screen.getAllByTestId("skeleton-col");
    expect(skeletons.length).toBe(3);
  });

  it("renders 3 columns with counts + example names when resolved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [
        ...mockGroups["made-daily"],
        ...mockGroups["made-to-order"],
      ]}),
    }));
    render(<MithaiFreshnessBoard />);
    await waitFor(() => {
      expect(screen.getByText(/Made daily/i)).toBeInTheDocument();
      expect(screen.getByText(/Made to order/i)).toBeInTheDocument();
      expect(screen.getByText(/Batch frozen/i)).toBeInTheDocument();
    });
    // Counts
    expect(screen.getByText("2")).toBeInTheDocument(); // made-daily
    expect(screen.getByText("1")).toBeInTheDocument(); // made-to-order
    expect(screen.getByText("0")).toBeInTheDocument(); // batch-frozen
  });

  it("renders empty state when no published mithai", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: []}),
    }));
    render(<MithaiFreshnessBoard />);
    await waitFor(() => {
      expect(screen.getByText(/No mithai published yet/i)).toBeInTheDocument();
    });
  });

  it("renders error message on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    render(<MithaiFreshnessBoard />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load mithai/i)).toBeInTheDocument();
    });
  });
});
