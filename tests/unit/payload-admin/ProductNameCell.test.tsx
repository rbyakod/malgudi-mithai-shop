import {describe, it, expect, vi, afterEach} from "vitest";
import type {ComponentType} from "react";
import {render, screen, waitFor} from "@testing-library/react";
import {makeProductNameCell} from "@/components/payload-admin/cells/ProductNameCell";
import type {ProductCellBehavior} from "@/components/payload-admin/cells/ProductNameCell";

vi.mock("next/image", () => ({
  default: ({src, alt, width, height}: {src?: string; alt?: string; width?: number; height?: number}) => (
    <img src={src} alt={alt} width={width} height={height} data-testid="img" />
  ),
}));

// Payload's DefaultCellComponentProps requires `collectionSlug` and `field` and
// forbids unknown `collectionField`. For unit testing we only care about
// `cellData` and `rowData`, so cast to a permissive render type.
type LooseCell = ComponentType<{
  cellData?: string | null;
  rowData?: Record<string, unknown>;
  collectionField?: {name: string};
}>;

describe("ProductNameCell", () => {
  const behavior: ProductCellBehavior = {
    image: {kind: "array", field: "images", imageKey: "image"},
    // Component renders plain-string meta items verbatim (its
    // `typeof m === "string"` branch), which these fixtures rely on.
    meta: (row: Record<string, unknown>) => [row.displayPrice, row.family].filter(Boolean) as unknown as {label: string}[],
    badges: (row: Record<string, unknown>) => row.freshnessStatus
      ? [{label: row.freshnessStatus as string, tone: "gold"}]
      : [],
  };
  const Cell = makeProductNameCell(behavior) as LooseCell;

  it("renders thumbnail when image present", () => {
    const rowData = {
      id: "1",
      name: "Kaju Katli",
      images: [{image: {url: "/media/kaju.jpg", alt: "Kaju"}}],
      displayPrice: "₹800",
      family: "classic",
      freshnessStatus: "made-daily",
    };
    render(<Cell cellData="Kaju Katli" rowData={rowData} collectionField={{name: "name"}} />);
    const img = screen.getByTestId("img");
    expect(img).toHaveAttribute("src", "/media/kaju.jpg");
  });

  it("renders fallback block when no image", () => {
    const rowData = {id: "2", name: "No-image sweet", images: [], displayPrice: "₹200", family: "classic"};
    const {container} = render(<Cell cellData="No-image sweet" rowData={rowData} collectionField={{name: "name"}} />);
    expect(container.querySelector("img")).toBeNull();
    // Fallback is a div with bg-muted class
    expect(container.querySelector(".mishran-cell-fallback")).not.toBeNull();
  });

  it("renders meta items in order", () => {
    const rowData = {id: "3", name: "X", images: [], displayPrice: "₹500", family: "classic"};
    const {container} = render(<Cell cellData="X" rowData={rowData} collectionField={{name: "name"}} />);
    const meta = container.querySelector(".mishran-cell-meta");
    expect(meta?.textContent).toContain("₹500");
    expect(meta?.textContent).toContain("classic");
  });

  it("renders badges when present", () => {
    const rowData = {id: "4", name: "Y", images: [], displayPrice: "₹100", family: "classic", freshnessStatus: "made-daily"};
    const {container} = render(<Cell cellData="Y" rowData={rowData} collectionField={{name: "name"}} />);
    const badges = container.querySelectorAll(".mishran-pill");
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toContain("made-daily");
  });

  it("falls back to rowData.name when cellData is empty", () => {
    const rowData = {id: "5", name: "Fallback Name", images: []};
    const {container} = render(<Cell cellData={null} rowData={rowData} collectionField={{name: "name"}} />);
    expect(container.textContent).toContain("Fallback Name");
  });

  it("handles single-image (upload) shape", () => {
    const singleBehavior: ProductCellBehavior = {
      image: {kind: "single", field: "image"},
      meta: (row: Record<string, unknown>) => [],
      badges: () => [],
    };
    const SingleCell = makeProductNameCell(singleBehavior) as LooseCell;
    const rowData = {id: "6", name: "Chai", image: {url: "/media/chai.jpg"}};
    render(<SingleCell cellData="Chai" rowData={rowData} collectionField={{name: "name"}} />);
    expect(screen.getByTestId("img")).toHaveAttribute("src", "/media/chai.jpg");
  });

  // The admin list fetches rows at depth=0, so relations arrive as bare IDs.
  // A bare ID must never become an img src (it 400s in /_next/image); the
  // cell defers to MediaThumb, which resolves it via a batched /api/media
  // lookup and swaps the fallback for a real thumbnail.
  describe("bare relation IDs (depth=0 list rows)", () => {
    const fetchMock = vi.fn();
    const mediaId = "6a7fc2cff20fc342eafe0e2e";

    afterEach(() => {
      vi.unstubAllGlobals();
      fetchMock.mockReset();
    });

    it("shows fallback first, then the resolved thumbnail, never the ID as src", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          docs: [{id: mediaId, url: "/api/media/file/kaju.jpg", alt: "Kaju Katli"}],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const rowData = {
        id: "7",
        name: "Kaju Katli",
        images: [{image: mediaId}],
      };
      const {container} = render(
        <Cell cellData="Kaju Katli" rowData={rowData} collectionField={{name: "name"}} />,
      );

      // Before the batch resolves: styled fallback, no img at all.
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector(".mishran-cell-fallback")).not.toBeNull();

      // After the batched /api/media lookup: real thumbnail URL.
      await waitFor(() => {
        expect(screen.getByTestId("img")).toHaveAttribute("src", "/api/media/file/kaju.jpg");
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const query = String(fetchMock.mock.calls[0][0]);
      expect(query).toContain("/api/media");
      expect(query).toContain(mediaId);
    });

    it("keeps the fallback when the media lookup fails", async () => {
      fetchMock.mockResolvedValue({ok: false, json: async () => ({})});
      vi.stubGlobal("fetch", fetchMock);

      const rowData = {id: "8", name: "Broken", images: [{image: "6a7fc2cff20fc342eafe0f3f"}]};
      const {container} = render(
        <Cell cellData="Broken" rowData={rowData} collectionField={{name: "name"}} />,
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 80));
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector(".mishran-cell-fallback")).not.toBeNull();
    });

    it("passes URL-looking strings straight to the image", () => {
      const rowData = {id: "9", name: "Legacy", images: [{image: "/api/media/file/legacy.jpg"}]};
      render(<Cell cellData="Legacy" rowData={rowData} collectionField={{name: "name"}} />);
      expect(screen.getByTestId("img")).toHaveAttribute("src", "/api/media/file/legacy.jpg");
    });

    it("resolves bare IDs in single-image (upload) shape too", async () => {
      // Unique ID: the resolver's module-level cache persists across tests.
      const singleMediaId = "6a7fc2cff20fc342eafe0a4a";
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({docs: [{id: singleMediaId, url: "/api/media/file/chai.jpg"}]}),
      });
      vi.stubGlobal("fetch", fetchMock);
      const singleBehavior: ProductCellBehavior = {
        image: {kind: "single", field: "image"},
        meta: () => [],
        badges: () => [],
      };
      const SingleCell = makeProductNameCell(singleBehavior) as LooseCell;
      const rowData = {id: "10", name: "Chai", image: singleMediaId};
      render(<SingleCell cellData="Chai" rowData={rowData} collectionField={{name: "name"}} />);
      await waitFor(() => {
        expect(screen.getByTestId("img")).toHaveAttribute("src", "/api/media/file/chai.jpg");
      });
    });
  });
});
