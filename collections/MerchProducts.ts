// collections/MerchProducts.ts
// Merchandise — tools, books, experiences. Schema per spec §7 /
// task-7-brief.md. Availability defaults to "enquiry-only" (most merch is
// lead-gen, not direct checkout) per the brief.
//
// Slug "merch-products" is the stable contract — referenced by Stories.
import type { CollectionConfig } from "payload";
import { makeRevalidateHook, makeRevalidateDeleteHook } from "./_revalidate-hook";

export const MerchProducts: CollectionConfig = {
  slug: "merch-products",
  access: { read: () => true },
  admin: { useAsTitle: "name", group: "02 Products" },
  hooks: {
    afterChange: [makeRevalidateHook("merch-products")],
    afterDelete: [makeRevalidateDeleteHook("merch-products")],
  },
  fields: [
    { name: "name", type: "text", required: true, localized: true },
    {
      name: "type",
      type: "select",
      options: ["tool", "book", "experience"],
      required: true,
    },
    { name: "description", type: "textarea", localized: true },
    {
      name: "images",
      type: "array",
      fields: [{ name: "image", type: "upload", relationTo: "media" }],
    },
    { name: "price", type: "text" },
    {
      name: "availability",
      type: "select",
      options: ["in-stock", "pre-order", "enquiry-only"],
      defaultValue: "enquiry-only",
    },
  ],
};
