import type { CollectionConfig } from "payload";

export const Addresses: CollectionConfig = {
  slug: "addresses",
  timestamps: true,
  admin: {
    useAsTitle: "line1",
    defaultColumns: ["line1", "city", "pincode", "tag"],
  },
  fields: [
    {
      name: "customerId",
      type: "relationship",
      relationTo: "customers",
      required: true,
      index: true,
    },
    { name: "line1", type: "text", required: true },
    { name: "line2", type: "text" },
    { name: "city", type: "text", required: true },
    { name: "state", type: "text", required: true },
    { name: "pincode", type: "text", required: true, maxLength: 10 },
    { name: "lat", type: "number" },
    { name: "lng", type: "number" },
    {
      name: "tag",
      type: "select",
      options: ["home", "work", "other"],
      defaultValue: "home",
    },
    { name: "isDefault", type: "checkbox", defaultValue: false },
  ],
};

export default Addresses;
