// collections/Payments.ts
// Payments collection — Task 1.6 (Mishran Mobile Apps v1).
// Schema per task-1.6-brief.md Step 1 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized; unique/sparse dropped
// on optional providerPaymentId — see brief corrections).
import type { CollectionConfig } from "payload";

export const Payments: CollectionConfig = {
  slug: "payments",
  timestamps: true,
  admin: {
    useAsTitle: "id",
    group: "Commerce",
    defaultColumns: [
      "id",
      "orderId",
      "status",
      "amountInPaise",
      "createdAt",
    ],
  },
  indexes: [{ fields: ["status", "createdAt"] }],
  fields: [
    {
      name: "orderId",
      type: "relationship",
      relationTo: "orders",
      required: true,
      index: true,
    },
    {
      name: "provider",
      type: "select",
      required: true,
      options: ["razorpay", "cashfree", "phonepe"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    { name: "providerOrderId", type: "text", index: true },
    // TODO: enforce unique providerPaymentId when set (service-layer validation,
    // not schema-level — Payload has no sparse option; marking it unique here
    // would cause null-conflicts between payments that have not yet been
    // assigned a provider payment id).
    { name: "providerPaymentId", type: "text", index: true },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        "created",
        "create_failed",
        "captured",
        "failed",
        "refunded",
        "partially_refunded",
      ].map((v) => ({ label: v, value: v })),
      index: true,
    },
    { name: "amountInPaise", type: "number", required: true, min: 0 },
    { name: "currency", type: "text", defaultValue: "INR", maxLength: 3 },
    {
      name: "method",
      type: "select",
      options: ["upi", "card", "netbanking", "wallet", "emi"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    {
      name: "rawWebhookEvents",
      type: "array",
      fields: [
        { name: "payload", type: "json" },
        { name: "receivedAt", type: "date" },
      ],
    },
  ],
};

export default Payments;
