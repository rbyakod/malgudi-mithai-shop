import {describe, it, expect, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import {makeProductNameCell} from "@/components/payload-admin/cells/ProductNameCell";
import type {ProductCellBehavior} from "@/components/payload-admin/cells/ProductNameCell";

vi.mock("next/image", () => ({
  default: ({src, alt, width, height}: any) => (
    <img src={src} alt={alt} width={width} height={height} data-testid="img" />
  ),
}));

describe("ProductNameCell", () => {
  const behavior: ProductCellBehavior = {
    image: {kind: "array", field: "images", imageKey: "image"},
    meta: (row: any) => [row.displayPrice, row.family].filter(Boolean),
    badges: (row: any) => row.freshnessStatus
      ? [{label: row.freshnessStatus, tone: "gold"}]
      : [],
  };
  // Payload's DefaultCellComponentProps requires `collectionSlug` and `field` and
  // forbids unknown `collectionField`. For unit testing we only care about
  // `cellData` and `rowData`, so cast to a permissive render type.
  const Cell = makeProductNameCell(behavior) as any;

  it("renders thumbnail when image present", () => {
    const rowData = {
      id: "1",
      name: "Kaju Katli",
      images: [{image: {url: "/media/kaju.jpg", alt: "Kaju"}}],
      displayPrice: "₹800",
      family: "classic",
      freshnessStatus: "made-daily",
    };
    render(<Cell cellData="Kaju Katli" rowData={rowData} collectionField={{name: "name"} as any} />);
    const img = screen.getByTestId("img");
    expect(img).toHaveAttribute("src", "/media/kaju.jpg");
  });

  it("renders fallback block when no image", () => {
    const rowData = {id: "2", name: "No-image sweet", images: [], displayPrice: "₹200", family: "classic"};
    const {container} = render(<Cell cellData="No-image sweet" rowData={rowData} collectionField={{name: "name"} as any} />);
    expect(container.querySelector("img")).toBeNull();
    // Fallback is a div with bg-muted class
    expect(container.querySelector(".mishran-cell-fallback")).not.toBeNull();
  });

  it("renders meta items in order", () => {
    const rowData = {id: "3", name: "X", images: [], displayPrice: "₹500", family: "classic"};
    const {container} = render(<Cell cellData="X" rowData={rowData} collectionField={{name: "name"} as any} />);
    const meta = container.querySelector(".mishran-cell-meta");
    expect(meta?.textContent).toContain("₹500");
    expect(meta?.textContent).toContain("classic");
  });

  it("renders badges when present", () => {
    const rowData = {id: "4", name: "Y", images: [], displayPrice: "₹100", family: "classic", freshnessStatus: "made-daily"};
    const {container} = render(<Cell cellData="Y" rowData={rowData} collectionField={{name: "name"} as any} />);
    const badges = container.querySelectorAll(".mishran-pill");
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toContain("made-daily");
  });

  it("falls back to rowData.name when cellData is empty", () => {
    const rowData = {id: "5", name: "Fallback Name", images: []};
    const {container} = render(<Cell cellData={null} rowData={rowData} collectionField={{name: "name"} as any} />);
    expect(container.textContent).toContain("Fallback Name");
  });

  it("handles single-image (upload) shape", () => {
    const singleBehavior: ProductCellBehavior = {
      image: {kind: "single", field: "image"},
      meta: (row: any) => [],
      badges: () => [],
    };
    const SingleCell = makeProductNameCell(singleBehavior) as any;
    const rowData = {id: "6", name: "Chai", image: {url: "/media/chai.jpg"}};
    render(<SingleCell cellData="Chai" rowData={rowData} collectionField={{name: "name"} as any} />);
    expect(screen.getByTestId("img")).toHaveAttribute("src", "/media/chai.jpg");
  });
});
