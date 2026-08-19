// collections/Shipments.ts
// Shipments collection — Task 1.6 (Mishran Mobile Apps v1).
// Schema per task-1.6-brief.md Step 2 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized — orderId already has
// field-level unique:true, no collection-level index needed).
import type { CollectionConfig } from "payload";

export const Shipments: CollectionConfig = {
  slug: "shipments",
  timestamps: true,
  admin: {
    useAsTitle: "orderId",
    group: "06 Commerce",
    defaultColumns: ["orderId", "currentStage", "updatedAt"],
  },
  fields: [
    {
      name: "orderId",
      type: "relationship",
      relationTo: "orders",
      required: true,
      unique: true,
    },
    {
      name: "currentStage",
      type: "select",
      required: true,
      options: [
        "confirmed",
        "packed",
        "dispatched",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
        "failed_delivery",
      ].map((v) => ({ label: v, value: v })),
    },
    {
      name: "history",
      type: "array",
      fields: [
        {
          name: "stage",
          type: "select",
          options: [
            "confirmed",
            "packed",
            "dispatched",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "returned",
            "failed_delivery",
          ].map((v) => ({ label: v, value: v })),
        },
        { name: "at", type: "date", required: true },
        { name: "note", type: "text" },
        { name: "actor", type: "text" },
      ],
    },
    { name: "eta", type: "date" },
    { name: "providerShipmentId", type: "text" },
    { name: "providerTrackingId", type: "text" },
  ],
};

export default Shipments;
