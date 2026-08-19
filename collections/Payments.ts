// collections/Payments.ts
// Payments collection — Task 1.6 (Mishran Mobile Apps v1).
// Schema per task-1.6-brief.md Step 1 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized; unique/sparse dropped
// on optional providerPaymentId — see brief corrections).
import type { CollectionConfig } from "payload";

// Custom Cell referenced by string path — Payload's importMap generator (and
// admin runtime) resolves it to components/payload-admin/cells/RupeeCell.
const RupeeCellPath = "./components/payload-admin/cells/RupeeCell";

export const Payments: CollectionConfig = {
  slug: "payments",
  labels: { singular: "Payment", plural: "Payments" },
  timestamps: true,
  admin: {
    useAsTitle: "id",
    group: "06 Commerce",
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
    {
      name: "amountInPaise",
      type: "number",
      required: true,
      min: 0,
      label: "Amount (paise)",
      admin: {
        description: "Stored in paise (₹1 = 100 paise) — lists display ₹.",
        components: {
          Cell: RupeeCellPath,
        },
      },
    },
    { name: "currency", type: "text", defaultValue: "INR", maxLength: 3 },
    {
      name: "method",
      type: "select",
      options: ["upi", "card", "netbanking", "wallet", "emi"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    // Ops-initiated refunds (#130). refundedInPaise accumulates across
    // partial refunds; `refunds` is the audit trail. Provider-issued ids are
    // kept so reconciliation can match them against settlement exports.
    {
      name: "refundedInPaise",
      type: "number",
      defaultValue: 0,
      min: 0,
      label: "Refunded (paise)",
      admin: {
        description:
          "Accumulated refunds in paise. Equals amountInPaise when fully refunded.",
      },
    },
    {
      name: "refunds",
      type: "array",
      labels: { singular: "Refund", plural: "Refunds" },
      fields: [
        { name: "providerRefundId", type: "text", required: true },
        { name: "amountInPaise", type: "number", required: true, min: 1 },
        { name: "reason", type: "text" },
        { name: "refundedBy", type: "text" },
        { name: "refundedAt", type: "date" },
      ],
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
