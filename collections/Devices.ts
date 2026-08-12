// collections/Devices.ts
// Devices collection — Task 1.7 (Mishran Mobile Apps v1).
// Schema per task-1.7-brief.md Step 2 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized to string arrays;
// `sparse` dropped — Payload 3.x has no sparse option; pushToken is
// required so unique is safe without sparse).
import type { CollectionConfig } from "payload";

export const Devices: CollectionConfig = {
  slug: "devices",
  timestamps: true,
  admin: {
    group: "Auth",
    defaultColumns: ["customerId", "platform", "active", "updatedAt"],
  },
  indexes: [
    { fields: ["customerId", "active"] },
  ],
  fields: [
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      required: true,
      index: true,
    },
    {
      name: "platform",
      type: "select",
      required: true,
      options: ["android", "ios"].map((v) => ({ label: v, value: v })),
    },
    // pushToken is required, so unique is safe (no null-conflict risk).
    // Field-level `unique: true` auto-creates the unique index.
    { name: "pushToken", type: "text", required: true, unique: true },
    { name: "appVersion", type: "text" },
    { name: "deviceModel", type: "text" },
    { name: "osVersion", type: "text" },
    { name: "locale", type: "text" },
    { name: "active", type: "checkbox", defaultValue: true },
  ],
};

export default Devices;
