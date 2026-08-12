import {describe, it, expect, vi} from "vitest";
import {render} from "@testing-library/react";
import {WordmarkLogo} from "@/components/payload-admin/graphics/WordmarkLogo";

vi.mock("next/image", () => ({
  default: ({src, alt, width, height, className}: any) => (
    <img src={src} alt={alt} width={width} height={height} className={className} data-testid="img" />
  ),
}));

describe("WordmarkLogo", () => {
  it("renders wordmark with default height 64", () => {
    const {getByTestId} = render(<WordmarkLogo />);
    const img = getByTestId("img");
    expect(img).toHaveAttribute("src", "/admin/mishran-wordmark.svg");
    expect(img).toHaveAttribute("height", "64");
  });

  it("accepts custom height", () => {
    const {getByTestId} = render(<WordmarkLogo height={96} />);
    expect(getByTestId("img")).toHaveAttribute("height", "96");
  });

  it("alt text describes the brand", () => {
    const {getByTestId} = render(<WordmarkLogo />);
    const alt = getByTestId("img").getAttribute("alt") ?? "";
    expect(alt.toLowerCase()).toContain("mishran");
  });
});
