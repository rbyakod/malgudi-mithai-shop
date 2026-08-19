import {describe, it, expect, vi} from "vitest";
import {render} from "@testing-library/react";
import {CrestIcon} from "@/components/payload-admin/graphics/CrestIcon";

// Mock next/image to render a plain img with src + alt props for assertion.
vi.mock("next/image", () => ({
  default: ({src, alt, width, height, className}: {src?: string; alt?: string; width?: number; height?: number; className?: string}) => (
    <img src={src} alt={alt} width={width} height={height} className={className} data-testid="img" />
  ),
}));

describe("CrestIcon", () => {
  it("renders image with crest src + default size 32", () => {
    const {getByTestId} = render(<CrestIcon />);
    const img = getByTestId("img");
    expect(img).toHaveAttribute("src", "/admin/mishran-crest.svg");
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
  });

  it("accepts custom size", () => {
    const {getByTestId} = render(<CrestIcon size={48} />);
    expect(getByTestId("img")).toHaveAttribute("width", "48");
    expect(getByTestId("img")).toHaveAttribute("height", "48");
  });

  it("accepts className override", () => {
    const {getByTestId} = render(<CrestIcon className="custom-class" />);
    expect(getByTestId("img")).toHaveAttribute("class", "custom-class");
  });

  it("has empty alt (decorative)", () => {
    const {getByTestId} = render(<CrestIcon />);
    expect(getByTestId("img")).toHaveAttribute("alt", "");
  });
});
