// scripts/seed-coupons.ts
// Known-gaps campaign B7 — seeds TEST coupons so the validate-with-coupon
// flow can be smoked end-to-end (live + staging). Safe to re-run: each code
// is upserted by find-first, never duplicated.
//
// Codes (TEST fixtures — flip `active` off before real marketing use):
//   TEST100  flat ₹100 off, no limits       — the happy-path smoke code
//   EXPIRED5 5% off, window closed 2026-08-01 — the rejection smoke code
import { getPayload } from "@/lib/payload-client";

type CouponFixture = {
  code: string;
  discountType: "percent" | "flat";
  value: number;
  minSubtotalInPaise?: number;
  maxDiscountInPaise?: number;
  activeFrom?: string;
  activeTo?: string;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  active: boolean;
};

const FIXTURES: CouponFixture[] = [
  {
    code: "TEST100",
    discountType: "flat",
    value: 10000,
    active: true,
  },
  {
    code: "EXPIRED5",
    discountType: "percent",
    value: 5,
    activeFrom: "2026-07-01T00:00:00.000Z",
    activeTo: "2026-08-01T00:00:00.000Z",
    active: true,
  },
];

async function main() {
  const payload = await getPayload();
  for (const fixture of FIXTURES) {
    const existing = await payload.find({
      collection: "coupons",
      where: { code: { equals: fixture.code } },
      limit: 1,
    });
    if (existing.docs.length > 0) {
      console.log(`skip  ${fixture.code} (exists)`);
      continue;
    }
    await payload.create({
      collection: "coupons",
      data: { ...fixture, usedCount: 0 },
    });
    console.log(`seed  ${fixture.code}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
