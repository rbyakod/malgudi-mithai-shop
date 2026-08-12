import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {AdminThemeSwitcher} from "@/components/payload-admin/theme/AdminThemeSwitcher";

describe("AdminThemeSwitcher", () => {
  beforeEach(() => {
    vi.stubGlobal("location", {reload: vi.fn()});
  });
  afterEach(() => {
    document.body.removeAttribute("data-admin-theme");
    vi.unstubAllGlobals();
  });

  it("renders a labeled select with 3 themes", () => {
    render(<AdminThemeSwitcher />);
    const select = screen.getByLabelText(/Admin theme/i);
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options.map(o => o.textContent)).toEqual([
      "Mishran (default)",
      "Mishran Midnight",
      "Mishran Monsoon",
    ]);
  });

  it("default-selected is mishran-admin when no body data attr", () => {
    render(<AdminThemeSwitcher />);
    const select = screen.getByLabelText(/Admin theme/i) as HTMLSelectElement;
    expect(select.value).toBe("mishran-admin");
  });

  it("reflects current body data-admin-theme as selected", () => {
    document.body.dataset.adminTheme = "mishran-midnight";
    render(<AdminThemeSwitcher />);
    const select = screen.getByLabelText(/Admin theme/i) as HTMLSelectElement;
    expect(select.value).toBe("mishran-midnight");
  });

  it("writes cookie + updates body data attr on change", async () => {
    const setItemSpy = vi.spyOn(document, "cookie", "set");
    render(<AdminThemeSwitcher />);
    fireEvent.change(screen.getByLabelText(/Admin theme/i), {target: {value: "mishran-monsoon"}});
    await waitFor(() => {
      expect(document.body.dataset.adminTheme).toBe("mishran-monsoon");
    });
    expect(setItemSpy).toHaveBeenCalledWith(
      expect.stringContaining("mishran-admin-theme=mishran-monsoon")
    );
    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining("SameSite=Lax"));
    expect(setItemSpy).toHaveBeenCalledWith(expect.stringContaining("Max-Age=31536000"));
  });
});
