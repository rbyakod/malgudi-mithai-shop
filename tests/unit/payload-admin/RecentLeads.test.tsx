import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {RecentLeads} from "@/components/payload-admin/dashboard/RecentLeads";

// Mocks the raw Payload `/leads` response (LeadDoc shape: contact sub-object).
// fetchRecentLeads maps doc.contact.name/email onto LeadRow.
const mockLeads = [
  {id: "1", contact: {name: "Ria Sharma", email: "ria@x.com"}, status: "new", createdAt: "2026-08-11T10:00:00Z"},
  {id: "2", contact: {name: "Arjun Patel", email: "arjun@y.com"}, status: "won", createdAt: "2026-08-10T10:00:00Z"},
];

describe("RecentLeads", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders 5 skeleton rows while loading", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {})); // never resolves
    render(<RecentLeads />);
    const skeletons = screen.getAllByTestId("skeleton-row");
    expect(skeletons.length).toBe(5);
  });

  it("renders rows when fetch resolves", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({docs: mockLeads, totalDocs: 2}),
    } as Response);
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText("Ria Sharma")).toBeInTheDocument();
      expect(screen.getByText("Arjun Patel")).toBeInTheDocument();
    });
  });

  it("renders status pill with correct text", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({docs: mockLeads, totalDocs: 2}),
    } as Response);
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText("new")).toBeInTheDocument();
      expect(screen.getByText("won")).toBeInTheDocument();
    });
  });

  it("renders empty state when no leads", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({docs: [], totalDocs: 0}),
    } as Response);
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText(/No leads yet/i)).toBeInTheDocument();
    });
  });

  it("renders error message when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network"));
    render(<RecentLeads />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load leads/i)).toBeInTheDocument();
    });
  });
});
