// tests/unit/catalog-serializers.test.ts
// lib/api/catalogSerializers.ts serializeProduct — the mobile PDP parity
// fields (Batch 2 of the iOS light-lock + PDP parity task): karigar arrives
// either populated (local API default depth) or as a bare id, and leadTime
// is optional text. The apps hide provenance rows on null, so the
// populated/id-only/absent matrix below is the whole contract.

import {describe, it, expect} from "vitest";
import {serializeProduct} from "@/lib/api/catalogSerializers";

const base = {
  id: "prod-1",
  slug: "kaju-katli",
  name: "Kaju Katli",
  family: "classic",
};

describe("serializeProduct karigar provenance", () => {
  it("extracts the karigar id + name when the relationship is populated", () => {
    const out = serializeProduct({
      ...base,
      karigar: {id: "kar-7", name: "Ramachandra Pai"},
    });
    expect(out.karigar).toBe("kar-7");
    expect(out.karigarName).toBe("Ramachandra Pai");
  });

  it("keeps the id but nulls the name for a bare id-string relation", () => {
    const out = serializeProduct({...base, karigar: "kar-7"});
    expect(out.karigar).toBe("kar-7");
    expect(out.karigarName).toBeNull();
  });

  it("nulls both when karigar is unset or populated without a name", () => {
    expect(serializeProduct({...base}).karigar).toBeNull();
    expect(serializeProduct({...base}).karigarName).toBeNull();
    expect(serializeProduct({...base, karigar: {id: "kar-7"}}).karigarName).toBeNull();
  });
});

describe("serializeProduct leadTime", () => {
  it("passes leadTime through when set", () => {
    expect(serializeProduct({...base, leadTime: "Made to order in 24h"}).leadTime).toBe(
      "Made to order in 24h",
    );
  });

  it("nulls leadTime when absent", () => {
    expect(serializeProduct({...base}).leadTime).toBeNull();
  });
});
