// collections/Coupons.ts
// Coupon codes — known-gaps campaign, Wave 2 foundation (B6; consumed by
// the coupons server batch B7).
//
// One row per code. The schema stores the RULES; all enforcement lives in
// lib/commerce/couponValidation.ts (pure) — active window, min subtotal,
// flat floor / percent cap math, usage limits. Stamping orders and
// incrementing usedCount happen in PayloadOrderService.createFromSnapshot
// (validate never burns a code; both the razorpay and COD paths do).
//
// Uniqueness of `code` is enforced service-side (trim + uppercase before
// every lookup/create) — Payload 3.x index configs have no sparse/unique
// option we can rely on here, and a unique index would also fight the
// case-insensitivity we normalize away instead.
import type { CollectionConfig } from "payload";

export const Coupons: CollectionConfig = {
  slug: "coupons",
  timestamps: true,
  admin: {
    useAsTitle: "code",
    defaultColumns: ["code", "discountType", "value", "active", "usedCount", "activeTo"],
    group: "Commerce",
  },
  indexes: [{ fields: ["code"] }],
  fields: [
    {
      // Stored uppercased; service code trims/upercases input before
      // comparing so "diwali10" and "DIWALI10" are the same coupon.
      name: "code",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "discountType",
      type: "select",
      required: true,
      options: [
        { label: "Percent off", value: "percent" },
        { label: "Flat ₹ off (paise)", value: "flat" },
      ],
    },
    {
      // percent: 10 = 10% off the subtotal. flat: value IS paise
      // (10000 = ₹100 off) so no float rupees ever touch money math.
      name: "value",
      type: "number",
      required: true,
      min: 0,
    },
    {
      // Cart must reach this subtotal (paise) before the code applies.
      name: "minSubtotalInPaise",
      type: "number",
      min: 0,
    },
    {
      // Cap on the computed discount (paise) — the percent guard rail.
      name: "maxDiscountInPaise",
      type: "number",
      min: 0,
    },
    {
      name: "activeFrom",
      type: "date",
    },
    {
      name: "activeTo",
      type: "date",
    },
    {
      // 0 = unlimited redemptions overall.
      name: "usageLimitTotal",
      type: "number",
      min: 0,
    },
    {
      // 0 = unlimited redemptions per customer.
      name: "usageLimitPerCustomer",
      type: "number",
      min: 0,
    },
    {
      // Orders created with this code. Maintained by create-order;
      // never edited by hand.
      name: "usedCount",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: "active",
      type: "checkbox",
      required: true,
      defaultValue: true,
    },
  ],
};

export default Coupons;
