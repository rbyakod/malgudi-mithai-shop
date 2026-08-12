import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MishranDashboard} from "@/components/payload-admin/dashboard/MishranDashboard";

// Mock one widget to throw an error during render
vi.mock("@/components/payload-admin/dashboard/MithaiFreshnessBoard", () => ({
  MithaiFreshnessBoard: () => {
    throw new Error("Simulated widget render failure");
  },
}));

describe("MishranDashboard widget isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("isolates widget failures — siblings keep rendering when one throws", async () => {
    // Suppress console.error for this test (React logs errors during boundary tests)
    const originalError = console.error;
    console.error = vi.fn();

    // Mock fetch so all widgets can render (except the one that throws)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({docs: [], totalDocs: 42}),
    }));

    // MithaiFreshnessBoard is mocked above to throw
    render(<MishranDashboard />);

    await waitFor(() => {
      // Verify the working widgets still render
      expect(screen.getByText("Recent leads")).toBeInTheDocument();
      expect(screen.getByText("Pending stories")).toBeInTheDocument();
      expect(screen.getByText("Catalog")).toBeInTheDocument();

      // Verify the failed widget shows WidgetErrorBoundary fallback
      expect(screen.getByText(/Couldn't load Mithai freshness/i)).toBeInTheDocument();

      // Verify the working widgets show actual content (Catalog shows 5 counts)
      expect(screen.getAllByText("42")).toHaveLength(5);
    });

    console.error = originalError;
  });
});
