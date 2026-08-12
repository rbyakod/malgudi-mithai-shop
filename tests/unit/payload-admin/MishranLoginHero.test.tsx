import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MishranLoginHero} from "@/components/payload-admin/login/MishranLoginHero";

vi.mock("next/image", () => ({
  default: ({src, alt, width, height}: any) => (
    <img src={src} alt={alt} width={width} height={height} data-testid="img" />
  ),
}));

describe("MishranLoginHero", () => {
  it("renders the crest image", () => {
    render(<MishranLoginHero />);
    const imgs = screen.getAllByTestId("img");
    const crest = imgs.find(img => img.getAttribute("src") === "/admin/mishran-crest.svg");
    expect(crest).toBeDefined();
  });

  it("renders tagline with Mishran brand", () => {
    render(<MishranLoginHero />);
    expect(screen.getByText(/Mishran/i)).toBeInTheDocument();
    expect(screen.getByText(/Sweets & Snacks/i)).toBeInTheDocument();
  });

  it("renders 'Editor Console' subtitle", () => {
    render(<MishranLoginHero />);
    expect(screen.getByText(/Editor Console/i)).toBeInTheDocument();
  });

  it("applies mishran-login-hero className for layout", () => {
    const {container} = render(<MishranLoginHero />);
    expect(container.querySelector(".mishran-login-hero")).not.toBeNull();
  });
});
