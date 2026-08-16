// collections/Orders.ts
// Orders collection — Task 1.5 (Mishran Mobile Apps v1).
// Shared commerce types live in lib/commerce/types.ts (consumed by services,
// mobile apps, and admin). Schema per task-1.5-brief.md Step 2 with
// corrections for Payload 3.x compatibility (see brief corrections).
import type { CollectionConfig } from "payload";

export const Orders: CollectionConfig = {
  slug: "orders",
  timestamps: true,
  admin: {
    useAsTitle: "id",
    defaultColumns: [
      "id",
      "customerId",
      "status",
      "totals.totalInPaise",
      "createdAt",
    ],
    group: "Commerce",
  },
  indexes: [{ fields: ["customerId", "createdAt"] }],
  fields: [
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      required: true,
      index: true,
    },
    {
      name: "items",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        {
          name: "productId",
          type: "relationship",
          relationTo: "mithai-products",
          required: true,
        },
        { name: "slug", type: "text", required: true },
        { name: "name", type: "text", required: true },
        { name: "quantity", type: "number", required: true, min: 1 },
        // Pack-size label the line was priced against (cart ids of the
        // form `${productId}:${packLabel}`). Optional — legacy/test orders
        // and base-pack lines carry none; reorder falls back to the base
        // pack for those. Copied through from cart snapshots at
        // create-order time.
        { name: "packLabel", type: "text" },
        { name: "unit", type: "text", required: true },
        { name: "priceInPaise", type: "number", required: true, min: 0 },
        { name: "image", type: "text" },
      ],
    },
    {
      name: "totals",
      type: "group",
      required: true,
      fields: [
        {
          name: "itemsTotalInPaise",
          type: "number",
          required: true,
        },
        {
          name: "deliveryFeeInPaise",
          type: "number",
          required: true,
        },
        { name: "taxesInPaise", type: "number", required: true },
        {
          name: "discountInPaise",
          type: "number",
          required: true,
          defaultValue: 0,
        },
        { name: "totalInPaise", type: "number", required: true },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "created",
      options: [
        "created",
        "pending_payment",
        "confirmed",
        "packed",
        "dispatched",
        "out_for_delivery",
        "delivered",
        "payment_failed",
        "cancelled",
        "returned",
        "failed_delivery",
        "abandoned",
      ].map((v) => ({ label: v, value: v })),
      index: true,
    },
    {
      name: "paymentStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: ["pending", "paid", "failed", "refunded", "partially_refunded"].map(
        (v) => ({ label: v, value: v }),
      ),
    },
    {
      name: "deliveryAddressId",
      type: "relationship",
      relationTo: "addresses",
      required: true,
    },
    {
      name: "slot",
      type: "group",
      fields: [
        { name: "date", type: "date" },
        { name: "window", type: "text" },
      ],
    },
    {
      name: "source",
      type: "select",
      required: true,
      options: ["mobile-android", "mobile-ios", "web"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    // TODO: enforce unique razorpayOrderId when set (service-layer validation,
    // not schema-level — Payload has no sparse option; marking it unique here
    // would cause null-conflicts between unpaid orders).
    { name: "razorpayOrderId", type: "text" },
    { name: "cartSnapshotId", type: "text" },
  ],
};

export default Orders;
