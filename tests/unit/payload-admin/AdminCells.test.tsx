import {describe, it, expect} from "vitest";
import {render} from "@testing-library/react";
import {RupeeCell} from "@/components/payload-admin/cells/RupeeCell";
import {OrderStatusCell} from "@/components/payload-admin/cells/OrderStatusCell";
import {FreshnessCell} from "@/components/payload-admin/cells/FreshnessCell";

// Audit §05/§06: the curated list cells. Paise render as ₹ with Indian
// digit grouping; statuses render as toned pills; freshness maps to the
// storefront vocabulary.

describe("RupeeCell", () => {
  it("renders whole-rupee amounts without decimals", () => {
    const {container} = render(<RupeeCell cellData={225800} />);
    expect(container.textContent).toBe("₹2,258");
  });

  it("renders sub-rupee amounts with two decimals", () => {
    const {container} = render(<RupeeCell cellData={225850} />);
    expect(container.textContent).toBe("₹2,258.50");
  });

  it("renders null/undefined/empty as nothing", () => {
    for (const value of [null, undefined, ""]) {
      const {container} = render(<RupeeCell cellData={value} />);
      expect(container.textContent).toBe("");
    }
  });

  it("falls back to the raw value when not numeric", () => {
    const {container} = render(<RupeeCell cellData="n/a" />);
    expect(container.textContent).toBe("n/a");
  });
});

describe("OrderStatusCell", () => {
  it("renders known statuses as humanized pills", () => {
    const {container} = render(<OrderStatusCell cellData="out_for_delivery" />);
    const pill = container.querySelector(".mishran-pill");
    expect(pill?.textContent).toBe("out for delivery");
    expect(pill?.className).toContain("mishran-pill--primary");
  });

  it("tones failed statuses as danger", () => {
    const {container} = render(<OrderStatusCell cellData="payment_failed" />);
    expect(container.querySelector(".mishran-pill")?.className).toContain(
      "mishran-pill--danger"
    );
  });

  it("tones delivered as success", () => {
    const {container} = render(<OrderStatusCell cellData="delivered" />);
    expect(container.querySelector(".mishran-pill")?.className).toContain(
      "mishran-pill--success"
    );
  });

  it("renders unknown values as muted pills without crashing", () => {
    const {container} = render(<OrderStatusCell cellData="warp_speed" />);
    const pill = container.querySelector(".mishran-pill");
    expect(pill?.textContent).toBe("warp speed");
    expect(pill?.className).toContain("mishran-pill--muted");
  });

  it("renders null as nothing", () => {
    const {container} = render(<OrderStatusCell cellData={null} />);
    expect(container.textContent).toBe("");
  });
});

describe("FreshnessCell", () => {
  it("maps known freshness values to storefront labels", () => {
    const cases: Array<[string, string]> = [
      ["made-daily", "Made daily"],
      ["made-to-order", "Made to order"],
      ["batch-frozen", "Batch frozen"],
    ];
    for (const [value, label] of cases) {
      const {container} = render(<FreshnessCell cellData={value} />);
      expect(container.querySelector(".mishran-pill")?.textContent).toBe(label);
    }
  });

  it("passes unknown values through as raw text", () => {
    const {container} = render(<FreshnessCell cellData="vacuum-packed" />);
    expect(container.textContent).toBe("vacuum-packed");
    expect(container.querySelector(".mishran-pill")).toBeNull();
  });

  it("renders null as nothing", () => {
    const {container} = render(<FreshnessCell cellData={null} />);
    expect(container.textContent).toBe("");
  });
});
