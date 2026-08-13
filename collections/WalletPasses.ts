// collections/WalletPasses.ts
// Apple Wallet loyalty-pass records — Task 19.1.
//
// One row per customer (keyed by customerId) recording the issued pass:
// serialNumber (the pass.json serial), tier (silver/gold), active flag, and
// the device push tokens registered for APNs `.pass` updates (Task 19.2).
// The GET /account/loyalty-pass route upserts here on generation; repeat
// requests reuse the row + regenerate only the signed URL.
import type { CollectionConfig } from "payload";

export const WalletPasses: CollectionConfig = {
  slug: "walletPasses",
  timestamps: true,
  admin: {
    group: "Commerce",
    defaultColumns: ["customerId", "tier", "serialNumber", "active", "updatedAt"],
  },
  indexes: [{ fields: ["customerId", "active"] }],
  fields: [
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      required: true,
      index: true,
    },
    // The pass.json serialNumber — also the WalletPassService.generatePass key.
    { name: "serialNumber", type: "text", required: true, unique: true },
    {
      name: "tier",
      type: "select",
      required: true,
      options: [
        { label: "Silver", value: "silver" },
        { label: "Gold", value: "gold" },
      ],
    },
    { name: "active", type: "checkbox", defaultValue: true },
    // Push tokens registered to receive APNs `.pass` updates for this pass
    // (Task 19.2). A pass may be added to multiple devices.
    {
      name: "devices",
      type: "array",
      fields: [{ name: "pushToken", type: "text", required: true }],
    },
  ],
};

export default WalletPasses;
