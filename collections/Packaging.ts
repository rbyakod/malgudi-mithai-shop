// collections/Packaging.ts
// Packaging inventory — boxes, trays, tins, hampers, carry-bags.
// Each packaging family has sizes, images, occasion fit, and a flag
// for whether it's customizable.
import type { CollectionConfig } from "payload";

export const Packaging: CollectionConfig = {
  slug: "packaging",
  access: { read: () => true },
  admin: { useAsTitle: "name" },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "family",
      type: "select",
      options: ["box", "tray", "tin", "hamper", "carry-bag"],
    },
    {
      name: "sizes",
      type: "array",
      fields: [
        { name: "label", type: "text" },
        { name: "capacity", type: "number" },
      ],
    },
    {
      name: "images",
      type: "array",
      fields: [{ name: "image", type: "upload", relationTo: "media" }],
    },
    {
      name: "occasionFit",
      type: "select",
      hasMany: true,
      options: ["diwali", "wedding", "rakhi", "corporate", "birthday"],
    },
    { name: "customizable", type: "checkbox" },
  ],
};
