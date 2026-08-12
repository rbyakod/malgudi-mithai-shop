// collections/ServiceablePincodes.ts
// ServiceablePincodes collection — Task 1.6 (Mishran Mobile Apps v1).
// Schema per task-1.6-brief.md Step 3 with corrections for Payload 3.x
// compatibility (Mongoose-style indexes normalized — pincode has field-level
// unique:true; tier and city carry field-level index:true).
import type { CollectionConfig } from "payload";

export const ServiceablePincodes: CollectionConfig = {
  slug: "serviceablePincodes",
  admin: {
    useAsTitle: "pincode",
    group: "Operations",
    defaultColumns: ["pincode", "tier", "city", "slaDays"],
  },
  fields: [
    {
      name: "pincode",
      type: "text",
      required: true,
      unique: true,
      maxLength: 10,
    },
    {
      name: "tier",
      type: "select",
      required: true,
      options: [
        { label: "Fresh (perishable)", value: "fresh" },
        { label: "Shelf-stable", value: "shelf" },
      ],
      index: true,
    },
    { name: "city", type: "text", required: true, index: true },
    { name: "state", type: "text", required: true },
    { name: "slaDays", type: "number", required: true, min: 0 },
    { name: "active", type: "checkbox", defaultValue: true },
  ],
};

export default ServiceablePincodes;
